import { describe, it, expect, beforeEach } from "vitest";
import { Suit } from "~CardLib/Model/Suit";
import { Colour } from "~CardLib/Model/Colour";
import { Rank } from "~CardLib/Model/Rank";
import { Game } from "./Game";
import { GameOptions } from "./GameOptions";

const consume = (gen: Generator) => {
    let res = gen.next();
    while (!res.done) {
        res = gen.next();
    }
};

describe("Scorpion Game Model", () => {
    let game: Game;

    beforeEach(() => {
        const options = new GameOptions(new URLSearchParams());
        options.autoReveal = false;
        game = new Game(options);
    });

    it("should initialize correctly", () => {
        expect(game.tableaux.length).toBe(7);
        expect(game.foundations.length).toBe(4);
        expect(game.reserve.length).toBe(52); // Starts in reserve before deal
        expect(game.won).toBe(false);
    });

    it("should deal cards correctly to the 7 tableaux piles and reserve", () => {
        consume(game.restart(12345));

        // 7 columns, each should have 7 cards initially
        for (let i = 0; i < 7; ++i) {
            expect(game.tableaux[i].length).toBe(7);
        }

        // Remaining 3 cards should be in reserve
        expect(game.reserve.length).toBe(3);

        // Check face down/up rules
        // In the first 4 columns, the bottom 3 cards are face down and the remaining 4 face up
        for (let i = 0; i < 4; ++i) {
            const pile = game.tableaux[i];
            expect(pile.at(0).faceUp).toBe(false);
            expect(pile.at(1).faceUp).toBe(false);
            expect(pile.at(2).faceUp).toBe(false);
            expect(pile.at(3).faceUp).toBe(true);
            expect(pile.at(4).faceUp).toBe(true);
            expect(pile.at(5).faceUp).toBe(true);
            expect(pile.at(6).faceUp).toBe(true);
        }

        // In the last 3 columns, all 7 cards are face up
        for (let i = 4; i < 7; ++i) {
            const pile = game.tableaux[i];
            for (let j = 0; j < 7; ++j) {
                expect(pile.at(j).faceUp).toBe(true);
            }
        }
    });

    it("should handle valid and invalid drops on tableaux based on suit and build-down", () => {
        consume(game.restart(1));

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];

        // Clear t0 and t1 for controlled testing
        const t6 = game.tableaux[6];
        while (t0.length > 0) t6.push(t0.peek()!);
        while (t1.length > 0) t6.push(t1.peek()!);

        const hearts5 = t1.createCard(Suit.Hearts, Colour.Red, Rank.Five);
        const hearts6 = t0.createCard(Suit.Hearts, Colour.Red, Rank.Six);
        const spades6 = t0.createCard(Suit.Spades, Colour.Black, Rank.Six);
        const hearts7 = t0.createCard(Suit.Hearts, Colour.Red, Rank.Seven);

        hearts5.faceUp = true;
        hearts6.faceUp = true;
        spades6.faceUp = true;
        hearts7.faceUp = true;

        game.cards.push(hearts5, hearts6, spades6, hearts7);

        t1.push(hearts5);

        // Hearts 5 can drop on Hearts 6 (same suit, build-down)
        t0.push(hearts6);
        expect(game.previewDrop(hearts5, t0)).toBe(true);
        t6.push(t0.peek()!);

        // Hearts 5 cannot drop on Spades 6 (different suit)
        t0.push(spades6);
        expect(game.previewDrop(hearts5, t0)).toBe(false);
        t6.push(t0.peek()!);

        // Hearts 5 cannot drop on Hearts 7 (not build-down by 1)
        t0.push(hearts7);
        expect(game.previewDrop(hearts5, t0)).toBe(false);
        t6.push(t0.peek()!);
    });

    it("should allow any face-up card to be moved regardless of its sequence, moving cover unit", () => {
        consume(game.restart(1));

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];

        const t6 = game.tableaux[6];
        while (t0.length > 0) t6.push(t0.peek()!);
        while (t1.length > 0) t6.push(t1.peek()!);

        const hearts6 = t0.createCard(Suit.Hearts, Colour.Red, Rank.Six);
        hearts6.faceUp = true;
        t0.push(hearts6);

        const hearts5 = t1.createCard(Suit.Hearts, Colour.Red, Rank.Five);
        const randomCard1 = t1.createCard(Suit.Spades, Colour.Black, Rank.Queen);
        const randomCard2 = t1.createCard(Suit.Diamonds, Colour.Red, Rank.Jack);

        hearts5.faceUp = true;
        randomCard1.faceUp = true;
        randomCard2.faceUp = true;

        game.cards.push(hearts5, randomCard1, randomCard2);

        t1.push(hearts5);
        t1.push(randomCard1);
        t1.push(randomCard2);

        // Dragging hearts5 from the middle of t1 onto hearts6 in t0 is valid because hearts5 builds on hearts6,
        // even though randomCard1 and randomCard2 are completely random and not sequential with hearts5.
        expect(game.previewDrop(hearts5, t0)).toBe(true);

        const dragRes = game.canDrag(hearts5);
        expect(dragRes.canDrag).toBe(true);
        expect(dragRes.extraCards).toEqual([randomCard1, randomCard2]);

        consume(game.dropCard(hearts5, t0));

        expect(t0.length).toBe(4); // hearts6, hearts5, randomCard1, randomCard2
        expect(t1.length).toBe(0);
    });

    it("should only allow a King or sequence headed by King into an empty column", () => {
        consume(game.restart(1));

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];

        const t6 = game.tableaux[6];
        while (t0.length > 0) t6.push(t0.peek()!);
        while (t1.length > 0) t6.push(t1.peek()!);

        expect(t0.length).toBe(0);

        const kingOfClubs = t1.createCard(Suit.Clubs, Colour.Black, Rank.King);
        const queenOfHearts = t1.createCard(Suit.Hearts, Colour.Red, Rank.Queen);

        kingOfClubs.faceUp = true;
        queenOfHearts.faceUp = true;

        game.cards.push(kingOfClubs, queenOfHearts);

        t1.push(kingOfClubs);
        t1.push(queenOfHearts);

        // Only King (or group headed by King) can drop on empty column
        expect(game.previewDrop(kingOfClubs, t0)).toBe(true);
        expect(game.previewDrop(queenOfHearts, t0)).toBe(false);
    });

    it("should turn over the top card of a tableau pile when it is exposed and autoReveal is true", () => {
        game.options.autoReveal = true;
        consume(game.restart(1));

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];

        // Ensure we clear the top face-up cards to expose a face-down card
        while (t0.length > 3) {
            t1.push(t0.peek()!);
        }

        expect(t0.length).toBe(3);
        expect(t0.peek()!.faceUp).toBe(false);

        // Force a drop/auto-move or call restart logic again to trigger doAutoMoves_
        // Since we pushed card via t1.push directly, let's trigger autoMoves by dropping a card
        const cardToDrop = t1.peek()!;
        cardToDrop.faceUp = true;

        // Wait, we can just execute the generator doAutoMoves_ directly
        const autoMovesGen = (game as any).doAutoMoves_();
        consume(autoMovesGen);

        expect(t0.peek()!.faceUp).toBe(true);
    });

    it("should deal reserve cards onto the first 3 columns when clicked", () => {
        consume(game.restart(1));

        expect(game.reserve.length).toBe(3);
        const initialLengths = game.tableaux.map(p => p.length); // [7, 7, 7, 7, 7, 7, 7]

        // Trigger primary action on reserve pile / card
        const reserveCard = game.reserve.peek()!;
        consume(game.cardPrimary(reserveCard));

        expect(game.reserve.length).toBe(0);
        expect(game.tableaux[0].length).toBe(initialLengths[0] + 1);
        expect(game.tableaux[1].length).toBe(initialLengths[1] + 1);
        expect(game.tableaux[2].length).toBe(initialLengths[2] + 1);
        expect(game.tableaux[3].length).toBe(initialLengths[3]);
    });

    it("should auto-complete and move full King down to Ace sequence of the same suit to foundation", () => {
        consume(game.restart(1));

        const t0 = game.tableaux[0];
        const t6 = game.tableaux[6];
        while (t0.length > 0) t6.push(t0.peek()!);

        // Create a perfect Hearts King to Ace sequence
        const suits = Suit.Hearts;
        const color = Colour.Red;
        const ranks = [
            Rank.King, Rank.Queen, Rank.Jack, Rank.Ten, Rank.Nine, Rank.Eight,
            Rank.Seven, Rank.Six, Rank.Five, Rank.Four, Rank.Three, Rank.Two, Rank.Ace
        ];

        for (const rank of ranks) {
            const card = t0.createCard(suits, color, rank);
            card.faceUp = true;
            game.cards.push(card);
            t0.push(card);
        }

        expect(t0.length).toBe(13);

        // Run auto moves
        consume((game as any).doAutoMoves_());

        expect(t0.length).toBe(0);
        expect(game.foundations[0].length).toBe(13);
    });
});
