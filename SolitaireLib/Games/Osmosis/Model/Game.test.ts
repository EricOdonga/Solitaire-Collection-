import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './Game';
import { GameOptions } from './GameOptions';
import { Suit } from '~CardLib/Model/Suit';
import { Rank } from '~CardLib/Model/Rank';
import { Card } from '~CardLib/Model/Card';
import { Colour } from '~CardLib/Model/Colour';

function runGenerator(gen: Generator<any, any, any>) {
    while (!gen.next().done) {}
}

describe('Osmosis Game Model', () => {
    let game: Game;

    beforeEach(() => {
        game = new Game(new GameOptions(new URLSearchParams()));
    });

    it('should initialize correctly', () => {
        expect(game.stock).toBeDefined();
        expect(game.waste).toBeDefined();
        expect(game.foundations.length).toBe(4);
        expect(game.reserves.length).toBe(4);
        expect(game.cards.length).toBe(52);
    });

    it('should deal cards correctly on restart', () => {
        runGenerator(game.restart(12345));

        // Reserves: 4 piles of 4 cards = 16 cards total
        expect(game.reserves.length).toBe(4);
        for (const res of game.reserves) {
            expect(res.length).toBe(4);
            expect(res.at(0).faceUp).toBe(false);
            expect(res.at(1).faceUp).toBe(false);
            expect(res.at(2).faceUp).toBe(false);
            expect(res.at(3).faceUp).toBe(true);
        }

        // Foundation 0 has exactly 1 card face up
        expect(game.foundations[0].length).toBe(1);
        expect(game.foundations[0].peek()!.faceUp).toBe(true);

        // Foundations 1, 2, 3 start completely empty
        expect(game.foundations[1].length).toBe(0);
        expect(game.foundations[2].length).toBe(0);
        expect(game.foundations[3].length).toBe(0);

        // Remaining 35 cards are in the stock
        expect(game.stock.length).toBe(35);
        expect(game.waste.length).toBe(0);
    });

    it('should only allow dragging top card of reserve or waste', () => {
        runGenerator(game.restart(12345));

        // Top card of reserve 0 is draggable
        const res0 = game.reserves[0];
        const topCard = res0.peek()!;
        expect(game.canDrag(topCard).canDrag).toBe(true);

        // Deeper cards in reserve 0 are not draggable
        const deeperCard = res0.at(2);
        expect(game.canDrag(deeperCard).canDrag).toBe(false);

        // Draw from stock to waste
        const stockTop = game.stock.peek()!;
        runGenerator(game.cardPrimary(stockTop));
        expect(game.waste.length).toBeGreaterThan(0);

        // Top of waste is draggable
        const wasteTop = game.waste.peek()!;
        expect(game.canDrag(wasteTop).canDrag).toBe(true);
    });

    it('should validate foundation drop rules (Osmosis)', () => {
        // Clear all piles and move all cards to stock first
        for (const card of game.cards) {
            game.stock.push(card);
        }

        // Find specific test cards
        const aceOfClubs = game.cards.find(c => c.suit === Suit.Clubs && c.rank === Rank.Ace)!;
        const aceOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.Ace)!;
        const aceOfHearts = game.cards.find(c => c.suit === Suit.Hearts && c.rank === Rank.Ace)!;
        const tenOfClubs = game.cards.find(c => c.suit === Suit.Clubs && c.rank === Rank.Ten)!;
        const tenOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.Ten)!;
        const fiveOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.Five)!;
        const kingOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.King)!;

        // Set up foundation 0 with Ace of Clubs (the starting card)
        game.foundations[0].push(aceOfClubs);
        aceOfClubs.faceUp = true;

        // Place test cards in the waste for testing (waste top is always draggable)
        game.waste.push(kingOfSpades);
        kingOfSpades.faceUp = true;

        // 1. Cannot start foundation 1 with King of Spades (must start with base rank Ace)
        expect(game.previewDrop(kingOfSpades, game.foundations[1])).toBe(false);

        // 2. Can start foundation 1 with Ace of Spades (valid rank, valid new suit, preceding foundation has Ace)
        game.waste.push(aceOfSpades);
        aceOfSpades.faceUp = true;
        expect(game.previewDrop(aceOfSpades, game.foundations[1])).toBe(true);

        // Drop Ace of Spades onto foundation 1
        runGenerator(game.dropCard(aceOfSpades, game.foundations[1]));
        expect(game.foundations[1].peek()).toBe(aceOfSpades);

        // 3. Cannot start foundation 2 with Ace of Spades (Clubs and Spades already used)
        // 4. Can start foundation 2 with Ace of Hearts
        game.waste.push(aceOfHearts);
        aceOfHearts.faceUp = true;
        expect(game.previewDrop(aceOfHearts, game.foundations[2])).toBe(true);

        // 5. Test osmosis sifting rule
        // Add Ten of Clubs to foundation 0
        game.foundations[0].push(tenOfClubs);
        tenOfClubs.faceUp = true;

        // Now foundation 0 has Ace and Ten of Clubs
        // foundation 1 has Ace of Spades
        // Try playing Ten of Spades to foundation 1
        game.waste.push(tenOfSpades);
        tenOfSpades.faceUp = true;
        // Ten of Spades should be valid because Ten of Clubs is in foundation 0
        expect(game.previewDrop(tenOfSpades, game.foundations[1])).toBe(true);

        // Try playing Five of Spades to foundation 1
        game.waste.push(fiveOfSpades);
        fiveOfSpades.faceUp = true;
        // Five of Spades should be invalid because Five of Clubs is not in foundation 0
        expect(game.previewDrop(fiveOfSpades, game.foundations[1])).toBe(false);
    });

    it('should detect when game is won', () => {
        expect(game.won).toBe(false);

        // Move all 52 cards directly to foundations
        const suits = [Suit.Clubs, Suit.Spades, Suit.Hearts, Suit.Diamonds];
        for (let i = 0; i < 4; ++i) {
            const f = game.foundations[i];
            const s = suits[i];
            const cardsOfSuit = game.cards.filter(c => c.suit === s);
            for (const c of cardsOfSuit) {
                f.push(c);
                c.faceUp = true;
            }
        }

        // Try dropping any card (or doing an operation) to trigger win check
        const testCard = game.cards[0];
        runGenerator(game.dropCard(testCard, game.foundations[0]));

        expect(game.won).toBe(true);
    });
});
