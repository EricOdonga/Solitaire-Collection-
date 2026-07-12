import { describe, it, expect, beforeEach } from "vitest";
import { Game } from "./Game";
import { GameOptions } from "./GameOptions";
import { Rank } from "~CardLib/Model/Rank";
import { Suit } from "~CardLib/Model/Suit";
import { Colour } from "~CardLib/Model/Colour";

const consume = (gen: Generator) => {
    let res = gen.next();
    while (!res.done) {
        res = gen.next();
    }
};

describe("PussInTheCorner Game Model", () => {
    let game: Game;

    beforeEach(() => {
        game = new Game(new GameOptions(new URLSearchParams()));
    });

    it("should initialize correctly", () => {
        expect(game.stock).toBeDefined();
        expect(game.foundations.length).toBe(4);
        expect(game.corners.length).toBe(4);
        expect(game.piles.length).toBe(9); // stock (1) + foundations (4) + corners (4)
    });

    it("should produce deterministic deal with a fixed seed", () => {
        const game1 = new Game(new GameOptions(new URLSearchParams()));
        consume(game1.restart(12345));

        const game2 = new Game(new GameOptions(new URLSearchParams()));
        consume(game2.restart(12345));

        expect(game1.stock.length).toBe(game2.stock.length);
        for (let i = 0; i < game1.stock.length; i++) {
            expect(game1.stock.at(i).suit).toBe(game2.stock.at(i).suit);
            expect(game1.stock.at(i).rank).toBe(game2.stock.at(i).rank);
        }
    });

    it("should have correct initial layout after restart", () => {
        consume(game.restart(12345));
        expect(game.stock.length).toBe(48);
        for (const foundation of game.foundations) {
            expect(foundation.length).toBe(1);
            expect(foundation.peek()?.rank).toBe(Rank.Ace);
            expect(foundation.peek()?.faceUp).toBe(true);
        }
        for (const corner of game.corners) {
            expect(corner.length).toBe(0);
        }
        expect(game.stock.peek()?.faceUp).toBe(true);
    });

    it("should allow dragging stock to any corner, and update dealtThisRound", () => {
        consume(game.restart(12345));
        const initialStockLength = game.stock.length;
        const topCard = game.stock.peek();
        expect(topCard).toBeDefined();

        // Check preview drop is true for any corner pile
        const corner = game.corners[0];
        expect(game.previewDrop(topCard!, corner)).toBe(true);

        // Drop the card
        consume(game.dropCard(topCard!, corner));
        expect(corner.length).toBe(1);
        expect(game.stock.length).toBe(initialStockLength - 1);
        expect(game.stock.peek()?.faceUp).toBe(true);

        // Drag corner card back to stock or other corner is not allowed
        const movedCard = corner.peek();
        expect(movedCard).toBeDefined();
        expect(game.previewDrop(movedCard!, game.stock)).toBe(false);
        expect(game.previewDrop(movedCard!, game.corners[1])).toBe(false);
    });

    it("should build foundations correctly by color and in sequence", () => {
        consume(game.restart(12345));

        // Find which foundation is which color
        const spadeFoundation = game.foundations.find(f => f.peek()?.suit === Suit.Spades)!;
        const heartFoundation = game.foundations.find(f => f.peek()?.suit === Suit.Hearts)!;

        // Create temporary cards for test
        // 2 of Clubs (Black)
        const twoClubs = spadeFoundation.createCard(Suit.Clubs, Colour.Black, Rank.Two);
        twoClubs.faceUp = true;
        game.cards.push(twoClubs);
        // 2 of Diamonds (Red)
        const twoDiamonds = heartFoundation.createCard(Suit.Diamonds, Colour.Red, Rank.Two);
        twoDiamonds.faceUp = true;
        game.cards.push(twoDiamonds);
        // 3 of Hearts (Red)
        const threeHearts = heartFoundation.createCard(Suit.Hearts, Colour.Red, Rank.Three);
        threeHearts.faceUp = true;
        game.cards.push(threeHearts);

        // Push to corner to play
        game.corners[0].push(twoClubs);
        game.corners[1].push(twoDiamonds);
        game.corners[2].push(threeHearts);

        // Can we play 2 of Clubs on Spade foundation? Yes, both are black!
        expect(game.previewDrop(twoClubs, spadeFoundation)).toBe(true);
        // Can we play 2 of Clubs on Heart foundation? No, different colors!
        expect(game.previewDrop(twoClubs, heartFoundation)).toBe(false);

        // Can we play 2 of Diamonds on Heart foundation? Yes, both are red!
        expect(game.previewDrop(twoDiamonds, heartFoundation)).toBe(true);

        // Can we play 3 of Hearts on Heart foundation directly? No, because it starts at Ace, so it expects 2 first!
        expect(game.previewDrop(threeHearts, heartFoundation)).toBe(false);

        // Perform drop 2 of Clubs to Spades foundation
        consume(game.dropCard(twoClubs, spadeFoundation));
        expect(spadeFoundation.length).toBe(2);
        expect(spadeFoundation.peek()).toBe(twoClubs);
    });

    it("should allow redeal once when stock is empty", () => {
        consume(game.restart(12345));

        // Let's exhaust the stock by moving all cards to corners
        while (game.stock.length > 0) {
            // Deal the card to corners
            const card = game.stock.peek()!;
            consume(game.dropCard(card, game.corners[0]));

            // If dealt 4, click stock to allow dealing more
            if (game.stock.length > 0 && !(game.stock.peek()?.faceUp)) {
                consume(game.pilePrimary(game.stock));
            }
        }

        expect(game.stock.length).toBe(0);

        // Click stock should trigger redeal and gather all cards back to stock
        consume(game.pilePrimary(game.stock));
        expect(game.stock.length).toBe(48);
        expect(game.stock.peek()?.faceUp).toBe(true);
    });

    it("should win when all foundations have 13 cards", () => {
        // Initially not won
        expect(game.won).toBe(false);

        consume(game.restart(12345));

        // Artificially fill all foundations up to 13 cards to check win condition
        // Since foundations start with 1 card (Ace)
        for (const foundation of game.foundations) {
            while (foundation.length < 13) {
                const dummy = foundation.createCard(foundation.peek()!.suit, foundation.peek()!.colour, Rank.Two);
                game.cards.push(dummy);
                foundation.push(dummy);
            }
        }

        // Trigger any operation to recheck won state, or check won directly if updated
        // doGetWon_ should return true
        const isWon = (game as any).doGetWon_();
        expect(isWon).toBe(true);
    });
});
