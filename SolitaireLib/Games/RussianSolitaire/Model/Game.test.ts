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

describe("Russian Solitaire Game Model", () => {
    let game: Game;

    beforeEach(() => {
        const options = new GameOptions(new URLSearchParams());
        options.autoReveal = false;
        options.autoMoveToFoundation = 0;
        game = new Game(options);
    });

    it("should initialize correctly", () => {
        expect(game.tableaux.length).toBe(7);
        expect(game.foundations.length).toBe(4);
        expect(game.won).toBe(false);
    });

    it("should deal cards correctly to the 7 tableaux piles", () => {
        consume(game.restart(12345));

        // Check each tableau length:
        // Column 0: 1 card face up, 0 face down (total 1)
        // Column 1: 5 cards face up, 1 face down (total 6)
        // Column 2: 5 cards face up, 2 face down (total 7)
        // Column 3: 5 cards face up, 3 face down (total 8)
        // Column 4: 5 cards face up, 4 face down (total 9)
        // Column 5: 5 cards face up, 5 face down (total 10)
        // Column 6: 5 cards face up, 6 face down (total 11)
        expect(game.tableaux[0]?.length).toBe(1);
        expect(game.tableaux[1]?.length).toBe(6);
        expect(game.tableaux[2]?.length).toBe(7);
        expect(game.tableaux[3]?.length).toBe(8);
        expect(game.tableaux[4]?.length).toBe(9);
        expect(game.tableaux[5]?.length).toBe(10);
        expect(game.tableaux[6]?.length).toBe(11);

        // Check face down/up counts
        for (let i = 0; i < 7; ++i) {
            const pile = game.tableaux[i];
            expect(pile).toBeDefined();
            if (!pile) continue;
            const faceDownCount = i;
            const faceUpCount = i === 0 ? 1 : 5;

            for (let j = 0; j < faceDownCount; ++j) {
                expect(pile.at(j)?.faceUp).toBe(false);
            }
            for (let j = faceDownCount; j < faceDownCount + faceUpCount; ++j) {
                expect(pile.at(j)?.faceUp).toBe(true);
            }
        }
    });

    it("should reject illegal drops on tableaux and foundations", () => {
        consume(game.restart(1));

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];
        const t6 = game.tableaux[6];

        expect(t0).toBeDefined();
        expect(t1).toBeDefined();
        expect(t6).toBeDefined();
        if (!t0 || !t1 || !t6) return;

        // Clear t0 and t1 completely
        while (t0.length > 0) t6.push(t0.peek()!);
        while (t1.length > 0) t6.push(t1.peek()!);

        expect(t0.length).toBe(0);
        expect(t1.length).toBe(0);

        // Create custom cards to test drop rules safely
        const heartsKing = t1.createCard(Suit.Hearts, Colour.Red, Rank.King);
        const spadesQueen = t1.createCard(Suit.Spades, Colour.Black, Rank.Queen);
        const heartsQueen = t1.createCard(Suit.Hearts, Colour.Red, Rank.Queen);
        const spadesJack = t1.createCard(Suit.Spades, Colour.Black, Rank.Jack);

        heartsKing.faceUp = true;
        spadesQueen.faceUp = true;
        heartsQueen.faceUp = true;
        spadesJack.faceUp = true;

        game.cards.push(heartsKing, spadesQueen, heartsQueen, spadesJack);

        // King can be dropped on empty tableau
        expect(game.previewDrop(heartsKing, t0)).toBe(true);

        // Queen cannot be dropped on empty tableau
        expect(game.previewDrop(heartsQueen, t0)).toBe(false);

        // Hearts Queen (same suit) can be dropped on Hearts King
        t0.push(heartsKing);
        t1.push(heartsQueen);
        expect(game.previewDrop(heartsQueen, t0)).toBe(true);

        // Spades Queen (different suit, opposite color) cannot be dropped on Hearts King
        t1.push(spadesQueen);
        expect(game.previewDrop(spadesQueen, t0)).toBe(false);
    });

    it("should allow Group Movement regardless of sequence", () => {
        consume(game.restart(1));

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];
        const t6 = game.tableaux[6];

        expect(t0).toBeDefined();
        expect(t1).toBeDefined();
        expect(t6).toBeDefined();
        if (!t0 || !t1 || !t6) return;

        // Clear t0 and t1 for determinism
        while (t0.length > 0) t6.push(t0.peek()!);
        while (t1.length > 0) t6.push(t1.peek()!);

        expect(t0.length).toBe(0);
        expect(t1.length).toBe(0);

        // Create a Hearts King at the bottom of t0
        const heartsKing = t0.createCard(Suit.Hearts, Colour.Red, Rank.King);
        heartsKing.faceUp = true;
        t0.push(heartsKing);

        // Create a non-sequential group in t1 starting with Hearts Queen (same suit as Hearts King)
        // Then subsequent cards on top of Hearts Queen can be completely out of sequence (e.g. Spades Queen, Spades Jack)
        const heartsQueen = t1.createCard(Suit.Hearts, Colour.Red, Rank.Queen);
        const spadesQueen = t1.createCard(Suit.Spades, Colour.Black, Rank.Queen);
        const spadesJack = t1.createCard(Suit.Spades, Colour.Black, Rank.Jack);

        heartsQueen.faceUp = true;
        spadesQueen.faceUp = true;
        spadesJack.faceUp = true;

        game.cards.push(heartsKing, heartsQueen, spadesQueen, spadesJack);

        t1.push(heartsQueen);
        t1.push(spadesQueen);
        t1.push(spadesJack);

        // Dragging the Hearts Queen (bottom of the group in t1) onto the Hearts King (top of t0)
        // This is valid because Hearts Queen is of the same suit and one rank lower,
        // even though other cards covering it are not in sequence!
        expect(game.previewDrop(heartsQueen, t0)).toBe(true);

        // If we drop it, the entire group [heartsQueen, spadesQueen, spadesJack] should move together
        const dragResult = game.canDrag(heartsQueen);
        expect(dragResult.canDrag).toBe(true);
        expect(dragResult.extraCards).toEqual([spadesQueen, spadesJack]);

        // Execute drop
        consume(game.dropCard(heartsQueen, t0));

        expect(t0.length).toBe(4); // heartsKing, heartsQueen, spadesQueen, spadesJack
        expect(t1.length).toBe(0);
        expect(t0.peek()).toBe(spadesJack);
    });

    it("should allow dropping Aces on empty foundations, and building up in suit", () => {
        consume(game.restart(1));

        const f0 = game.foundations[0];
        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];
        const t2 = game.tableaux[2];
        const t6 = game.tableaux[6];

        expect(f0).toBeDefined();
        expect(t0).toBeDefined();
        expect(t1).toBeDefined();
        expect(t2).toBeDefined();
        expect(t6).toBeDefined();
        if (!f0 || !t0 || !t1 || !t2 || !t6) return;

        // Clear t0, t1, t2 completely
        while (t0.length > 0) t6.push(t0.peek()!);
        while (t1.length > 0) t6.push(t1.peek()!);
        while (t2.length > 0) t6.push(t2.peek()!);

        // Create custom cards in separate tableaux so they are all single top cards of their piles
        const aceOfHearts = t1.createCard(Suit.Hearts, Colour.Red, Rank.Ace);
        const twoOfHearts = t0.createCard(Suit.Hearts, Colour.Red, Rank.Two);
        const aceOfSpades = t2.createCard(Suit.Spades, Colour.Black, Rank.Ace);

        game.cards.push(aceOfHearts, twoOfHearts, aceOfSpades);
        t1.push(aceOfHearts);
        t0.push(twoOfHearts);
        t2.push(aceOfSpades);

        aceOfHearts.faceUp = true;
        twoOfHearts.faceUp = true;
        aceOfSpades.faceUp = true;

        // Ace can drop on empty foundation
        expect(game.previewDrop(aceOfHearts, f0)).toBe(true);

        // Two cannot drop on empty foundation
        expect(game.previewDrop(twoOfHearts, f0)).toBe(false);

        // Put Ace in foundation
        f0.push(aceOfHearts);

        // Two of same suit can drop on Ace
        expect(game.previewDrop(twoOfHearts, f0)).toBe(true);

        // Ace of another suit cannot drop on Hearts foundation
        expect(game.previewDrop(aceOfSpades, f0)).toBe(false);
    });
});
