import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './Game';
import { GameOptions } from './GameOptions';
import { Suit } from '~CardLib/Model/Suit';
import { Rank } from '~CardLib/Model/Rank';
import { Card } from '~CardLib/Model/Card';

function runGenerator(gen: Generator<any, any, any>) {
    while (!gen.next().done) {}
}

describe('Black Hole Game Model', () => {
    let game: Game;

    beforeEach(() => {
        game = new Game(new GameOptions(new URLSearchParams()));
    });

    it('should initialize correctly', () => {
        expect(game.foundation).toBeDefined();
        expect(game.tableaux.length).toBe(17);
        expect(game.cards.length).toBe(52);
    });

    it('should deal cards correctly on restart', () => {
        runGenerator(game.restart(12345));

        // Foundation should have exactly 1 card: the Ace of Spades
        expect(game.foundation.length).toBe(1);
        const centerCard = game.foundation.peek()!;
        expect(centerCard.suit).toBe(Suit.Spades);
        expect(centerCard.rank).toBe(Rank.Ace);
        expect(centerCard.faceUp).toBe(true);

        // All 17 tableaux should have exactly 3 cards each and be face up
        expect(game.tableaux.length).toBe(17);
        for (const tab of game.tableaux) {
            expect(tab.length).toBe(3);
            for (let i = 0; i < tab.length; ++i) {
                expect(tab.at(i).faceUp).toBe(true);
            }
        }
    });

    it('should only allow dragging the top card of a tableau fan', () => {
        runGenerator(game.restart(12345));

        const tab = game.tableaux[0];
        const cardTop = tab.at(2);
        const cardMiddle = tab.at(1);

        // Top card is draggable
        const dragTop = game.canDrag(cardTop);
        expect(dragTop.canDrag).toBe(true);
        expect(dragTop.extraCards.length).toBe(0);

        // Middle card is not draggable
        const dragMiddle = game.canDrag(cardMiddle);
        expect(dragMiddle.canDrag).toBe(false);

        // Foundation card is not draggable
        const dragFoundation = game.canDrag(game.foundation.peek()!);
        expect(dragFoundation.canDrag).toBe(false);
    });

    it('should validate build rules with full cyclic wraparound', () => {
        // Move all cards to foundation to start with a controlled state
        for (const card of game.cards) {
            game.foundation.push(card);
        }

        const aceOfHearts = game.cards.find(c => c.suit === Suit.Hearts && c.rank === Rank.Ace)!;
        const kingOfClubs = game.cards.find(c => c.suit === Suit.Clubs && c.rank === Rank.King)!;
        const queenOfDiamonds = game.cards.find(c => c.suit === Suit.Diamonds && c.rank === Rank.Queen)!;
        const twoOfDiamonds = game.cards.find(c => c.suit === Suit.Diamonds && c.rank === Rank.Two)!;
        const fiveOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.Five)!;
        const sixOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.Six)!;

        // Set up the board: Ace of Hearts at top of foundation
        game.foundation.push(aceOfHearts);
        aceOfHearts.faceUp = true;

        // Place test cards onto tableau 0 to test their validity
        const tab = game.tableaux[0];

        // 1. King of Clubs (King follows Ace) - valid
        tab.push(kingOfClubs);
        kingOfClubs.faceUp = true;
        expect(game.previewDrop(kingOfClubs, game.foundation)).toBe(true);

        // 2. Two of Diamonds (Two follows Ace) - valid
        tab.push(twoOfDiamonds);
        twoOfDiamonds.faceUp = true;
        expect(game.previewDrop(twoOfDiamonds, game.foundation)).toBe(true);

        // 3. Queen of Diamonds (Queen cannot follow Ace) - invalid
        tab.push(queenOfDiamonds);
        queenOfDiamonds.faceUp = true;
        expect(game.previewDrop(queenOfDiamonds, game.foundation)).toBe(false);

        // Now change foundation top to King of Clubs
        game.foundation.push(kingOfClubs);
        kingOfClubs.faceUp = true;

        // 4. Ace of Hearts (Ace follows King) - valid
        tab.push(aceOfHearts);
        aceOfHearts.faceUp = true;
        expect(game.previewDrop(aceOfHearts, game.foundation)).toBe(true);

        // 5. Queen of Diamonds (Queen follows King) - valid
        tab.push(queenOfDiamonds);
        queenOfDiamonds.faceUp = true;
        expect(game.previewDrop(queenOfDiamonds, game.foundation)).toBe(true);

        // 6. Five of Spades (Five cannot follow King) - invalid
        tab.push(fiveOfSpades);
        fiveOfSpades.faceUp = true;
        expect(game.previewDrop(fiveOfSpades, game.foundation)).toBe(false);

        // Now change foundation top to Six of Spades
        game.foundation.push(sixOfSpades);
        sixOfSpades.faceUp = true;

        // 7. Five of Spades (Five follows Six) - valid
        tab.push(fiveOfSpades);
        fiveOfSpades.faceUp = true;
        expect(game.previewDrop(fiveOfSpades, game.foundation)).toBe(true);
    });

    it('should drop valid cards onto the foundation and not drop invalid ones', () => {
        for (const card of game.cards) {
            game.foundation.push(card);
        }

        const aceOfHearts = game.cards.find(c => c.suit === Suit.Hearts && c.rank === Rank.Ace)!;
        const twoOfDiamonds = game.cards.find(c => c.suit === Suit.Diamonds && c.rank === Rank.Two)!;
        const fiveOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.Five)!;

        // Foundation shows Ace of Hearts
        game.foundation.push(aceOfHearts);
        aceOfHearts.faceUp = true;

        // Two of Diamonds is in tableau 0
        const tab = game.tableaux[0];
        tab.push(twoOfDiamonds);
        twoOfDiamonds.faceUp = true;

        // Try dropping valid Two of Diamonds onto foundation
        runGenerator(game.dropCard(twoOfDiamonds, game.foundation));
        expect(game.foundation.peek()).toBe(twoOfDiamonds);
        expect(tab.length).toBe(0);

        // Try dropping invalid Five of Spades onto foundation
        tab.push(fiveOfSpades);
        fiveOfSpades.faceUp = true;
        runGenerator(game.dropCard(fiveOfSpades, game.foundation));
        expect(game.foundation.peek()).toBe(twoOfDiamonds); // remains Two of Diamonds
        expect(tab.length).toBe(1);
    });

    it('should win the game when all 52 cards are in the foundation', () => {
        expect(game.won).toBe(false);

        // Move all 52 cards to foundation
        for (const card of game.cards) {
            game.foundation.push(card);
        }

        // Trigger a won check by running dropCard (or restart/primary operation)
        // Since doGetWon_ directly checks length, any action committing will update the won state,
        // or we can invoke game.restart and then win, but we can also mock winning:
        const aceOfSpades = game.cards.find(c => c.suit === Suit.Spades && c.rank === Rank.Ace)!;
        const twoOfDiamonds = game.cards.find(c => c.suit === Suit.Diamonds && c.rank === Rank.Two)!;

        // Set up the 51 cards in foundation, and 1 valid last card in tableau 0
        for (const card of game.cards) {
            if (card !== twoOfDiamonds) {
                game.foundation.push(card);
            }
        }
        // Top of foundation is Ace of Spades (value 1)
        game.foundation.push(aceOfSpades);
        aceOfSpades.faceUp = true;

        // Tableau 0 has twoOfDiamonds (value 2)
        game.tableaux[0].push(twoOfDiamonds);
        twoOfDiamonds.faceUp = true;

        expect(game.won).toBe(false);

        // Drop the last card
        runGenerator(game.dropCard(twoOfDiamonds, game.foundation));

        expect(game.won).toBe(true);
    });
});
