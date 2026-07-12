import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './Game';
import { GameOptions } from './GameOptions';
import { Rank } from '~CardLib/Model/Rank';
import { Suit } from '~CardLib/Model/Suit';
import { Colour } from '~CardLib/Model/Colour';
import { Pile } from '~CardLib/Model/Pile';

describe('Spiderette Game Model', () => {
    let game: Game;

    const clearPile = (pile: Pile) => {
        const tempPile = new Pile(game);
        while (pile.length > 0) {
            const card = pile.peek();
            if (card) {
                tempPile.push(card);
            }
        }
    };

    beforeEach(() => {
        game = new Game(new GameOptions(new URLSearchParams()));
    });

    it('should initialize and deal correctly', () => {
        game.options.autoReveal = false;

        // Run restart generator
        Array.from(game.restart(12345));

        // 7 tableaux piles, 4 foundations, 1 stock
        expect(game.tableaux.length).toBe(7);
        expect(game.foundations.length).toBe(4);
        expect(game.stock).toBeDefined();

        // 28 cards total dealt initially across 7 tableaux:
        // Col 1 gets 1 card, Col 2 gets 2 cards, ..., Col 7 gets 7 cards.
        let totalDealt = 0;
        for (let i = 0; i < 7; i++) {
            const pile = game.tableaux[i];
            const expectedCount = i + 1;
            if (pile) {
                expect(pile.length).toBe(expectedCount);
                totalDealt += pile.length;

                // Only top card is face up, the rest are face down
                for (let j = 0; j < expectedCount - 1; j++) {
                    expect(pile.at(j)?.faceUp).toBe(false);
                }
                expect(pile.peek()?.faceUp).toBe(true);
            }
        }
        expect(totalDealt).toBe(28);

        // Remaining 52 - 28 = 24 cards are in stock
        expect(game.stock.length).toBe(24);
        for (let i = 0; i < game.stock.length; i++) {
            expect(game.stock.at(i)?.faceUp).toBe(false);
        }
    });

    it('should only allow dragging single cards or perfect same-suit descending sequences', () => {
        // Run restart generator
        Array.from(game.restart(12345));

        // Clear tableaux[0]
        const tab0 = game.tableaux[0];
        if (tab0) {
            clearPile(tab0);

            // Build a same-suit descending sequence on tableaux[0]
            const s8 = tab0.createCard(Suit.Spades, Colour.Black, Rank.Eight);
            const s7 = tab0.createCard(Suit.Spades, Colour.Black, Rank.Seven);
            const s6 = tab0.createCard(Suit.Spades, Colour.Black, Rank.Six);

            s8.faceUp = true;
            s7.faceUp = true;
            s6.faceUp = true;

            game.cards.push(s8, s7, s6);
            tab0.push(s8);
            tab0.push(s7);
            tab0.push(s6);

            // Dragging the whole pile starting at s8 should be allowed (same-suit, descending)
            const drag8 = game.canDrag(s8);
            expect(drag8.canDrag).toBe(true);
            expect(drag8.extraCards.length).toBe(2);
            expect(drag8.extraCards[0]).toBe(s7);
            expect(drag8.extraCards[1]).toBe(s6);

            // If sequence has different suits (e.g. Spades 8, Hearts 7, Spades 6)
            clearPile(tab0);
            const h7 = tab0.createCard(Suit.Hearts, Colour.Red, Rank.Seven);
            h7.faceUp = true;
            game.cards.push(h7);

            tab0.push(s8);
            tab0.push(h7);
            tab0.push(s6);

            // Dragging starting at s8 should be rejected (mixed suits)
            expect(game.canDrag(s8).canDrag).toBe(false);

            // Dragging starting at h7 should also be rejected because Spades 6 is on top of Hearts 7 (mixed suits)
            expect(game.canDrag(h7).canDrag).toBe(false);

            // Dragging s6 directly should be allowed (it is top card)
            expect(game.canDrag(s6).canDrag).toBe(true);
        }
    });

    it('should build down regardless of suit, and fill empty spaces with any card or sequence', () => {
        // Run restart generator
        Array.from(game.restart(12345));

        // Clear tableaux[0] and tableaux[1]
        const tab0 = game.tableaux[0];
        const tab1 = game.tableaux[1];
        if (tab0 && tab1) {
            clearPile(tab0);
            clearPile(tab1);

            // Place a Hearts 7 in tableaux[0]
            const h7 = tab0.createCard(Suit.Hearts, Colour.Red, Rank.Seven);
            h7.faceUp = true;
            game.cards.push(h7);
            tab0.push(h7);

            // Place a Spades 6 in tableaux[1] (valid drag source)
            const s6 = tab1.createCard(Suit.Spades, Colour.Black, Rank.Six);
            s6.faceUp = true;
            game.cards.push(s6);
            tab1.push(s6);

            // Can drop Spades 6 on Hearts 7 (builds down regardless of suit!)
            expect(game.previewDrop(s6, tab0)).toBe(true);

            // Empty slot test: clear tableaux[0]
            clearPile(tab0);
            // Can drop any card (like Spades 6) on an empty tableau
            expect(game.previewDrop(s6, tab0)).toBe(true);
        }
    });

    it('should deal 1 card face up to each tableau column when stock is clicked if none are empty', () => {
        // Run restart generator
        Array.from(game.restart(12345));

        const initialStockLen = game.stock.length;
        const initialLengths = game.tableaux.map(t => t.length);

        // Trigger deal from stock
        Array.from((game as any).doDrawFromStock_());

        // Stock decreased by 7
        expect(game.stock.length).toBe(initialStockLen - 7);

        // Every tableau has 1 more card, and it is face up
        for (let i = 0; i < 7; i++) {
            expect(game.tableaux[i]?.length).toBe((initialLengths[i] ?? 0) + 1);
            expect(game.tableaux[i]?.peek()?.faceUp).toBe(true);
        }

        // Empty tableau constraint: if one tableau is empty, we should not be able to draw from stock
        const tab0 = game.tableaux[0];
        if (tab0) {
            clearPile(tab0);
            expect((game as any).canDrawFromStock_()).toBe(false);
        }
    });

    it('should automatically clear complete King-to-Ace same-suit sequences to foundation', () => {
        // Run restart generator
        Array.from(game.restart(12345));

        // Clear tableaux[0] and put a complete sequence of Spades King to Ace
        const tab0 = game.tableaux[0];
        if (tab0) {
            clearPile(tab0);
            for (let r = 13; r >= 1; r--) {
                // Rank values map from King (13) to Ace (1)
                let rank: Rank;
                if (r === 13) rank = Rank.King;
                else if (r === 12) rank = Rank.Queen;
                else if (r === 11) rank = Rank.Jack;
                else if (r === 10) rank = Rank.Ten;
                else if (r === 9) rank = Rank.Nine;
                else if (r === 8) rank = Rank.Eight;
                else if (r === 7) rank = Rank.Seven;
                else if (r === 6) rank = Rank.Six;
                else if (r === 5) rank = Rank.Five;
                else if (r === 4) rank = Rank.Four;
                else if (r === 3) rank = Rank.Three;
                else if (r === 2) rank = Rank.Two;
                else rank = Rank.Ace;

                const card = tab0.createCard(Suit.Spades, Colour.Black, rank);
                card.faceUp = true;
                game.cards.push(card);
                tab0.push(card);
            }

            // Initially foundations are empty
            expect(game.foundations[0]?.length).toBe(0);

            // Run autoMoves to detect and transfer the completed sequence
            Array.from((game as any).doAutoMoves_());

            // Foundation 0 should now have the 13 cards of the completed sequence!
            expect(game.foundations[0]?.length).toBe(13);
            expect(tab0.length).toBe(0);
        }
    });

    it('should detect win when all 52 cards are in foundations', () => {
        expect((game as any).doGetWon_()).toBe(false);

        // Put all cards into foundations
        for (let i = 0; i < game.cards.length; i++) {
            // Divide 52 cards evenly into 4 foundations (13 cards each)
            const f = game.foundations[i % 4];
            const c = game.cards[i];
            if (f && c) {
                f.push(c);
            }
        }

        expect((game as any).doGetWon_()).toBe(true);

        (game as any).checkWon_();
        expect(game.won).toBe(true);
    });
});
