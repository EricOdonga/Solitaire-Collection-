import { describe, it, expect, beforeEach } from "vitest";
import { Game } from "./Game";
import { GameOptions } from "./GameOptions";
import { Rank } from "~CardLib/Model/Rank";
import { Suit } from "~CardLib/Model/Suit";

const consume = (gen: Generator) => {
    let res = gen.next();
    while (!res.done) {
        res = gen.next();
    }
};

describe("Streets and Alleys Game Model", () => {
    let game: Game;

    beforeEach(() => {
        const options = new GameOptions(new URLSearchParams());
        options.autoMoveToFoundation = 0; // Disable auto moves for predictable test behavior
        game = new Game(options);
    });

    it("should initialize correctly", () => {
        expect(game.foundations.length).toBe(4);
        expect(game.tableaux.length).toBe(8);
        expect(game.won).toBe(false);
    });

    it("should setup game and deal cards on restart", () => {
        consume(game.restart(12345));

        // All 4 foundations should start completely empty
        for (const foundation of game.foundations) {
            expect(foundation.length).toBe(0);
        }

        // 8 tableaux should have 52 cards in total (4 piles of 7, 4 piles of 6)
        let totalTableauCards = 0;
        const pileLengths: number[] = [];
        for (const tab of game.tableaux) {
            pileLengths.push(tab.length);
            totalTableauCards += tab.length;
        }
        expect(totalTableauCards).toBe(52);

        // Count how many have 7 and how many have 6
        const count7 = pileLengths.filter(l => l === 7).length;
        const count6 = pileLengths.filter(l => l === 6).length;
        expect(count7).toBe(4);
        expect(count6).toBe(4);

        // Every card in play should be face up
        for (const card of game.cards) {
            expect(card.faceUp).toBe(true);
        }
    });

    it("should produce deterministic deal with a fixed seed", () => {
        const options = new GameOptions(new URLSearchParams());
        options.autoMoveToFoundation = 0;
        const game1 = new Game(options);
        consume(game1.restart(999));

        const game2 = new Game(options);
        consume(game2.restart(999));

        // Check if tableau cards are in the same order
        for (let j = 0; j < 8; j++) {
            const pile1 = game1.tableaux[j]!;
            const pile2 = game2.tableaux[j]!;
            expect(pile1.length).toBe(pile2.length);
            for (let i = 0; i < pile1.length; i++) {
                expect(pile1.at(i).suit).toBe(pile2.at(i).suit);
                expect(pile1.at(i).rank).toBe(pile2.at(i).rank);
            }
        }
    });

    it("should allow building down on tableaux regardless of suit or color", () => {
        consume(game.restart(12));

        const topCard0 = game.tableaux[0]?.peek();
        const topCard1 = game.tableaux[1]?.peek();

        if (topCard0 && topCard1) {
            // Place topCard0 (Rank.Five) onto topCard1 (Rank.Six)
            (topCard0 as any).rank = Rank.Five;
            (topCard1 as any).rank = Rank.Six;

            const canDrop = (game as any).previewDrop_(topCard0, game.tableaux[1]);
            expect(canDrop).toBe(true);
        }
    });

    it("should reject non-consecutive ranks on tableaux", () => {
        consume(game.restart(12));

        const topCard0 = game.tableaux[0]?.peek();
        const topCard1 = game.tableaux[1]?.peek();

        if (topCard0 && topCard1) {
            // Place 5 onto 8
            (topCard0 as any).rank = Rank.Five;
            (topCard1 as any).rank = Rank.Eight;

            const canDrop = (game as any).previewDrop_(topCard0, game.tableaux[1]);
            expect(canDrop).toBe(false);
        }
    });

    it("should allow placing any single card onto an empty tableau pile", () => {
        consume(game.restart(12));

        // Manually clear tableau 0
        const tab0 = game.tableaux[0]!;
        while (tab0.length > 0) {
            const c = tab0.peek()!;
            game.tableaux[1]!.push(c);
        }
        expect(tab0.length).toBe(0);

        // Now pick a top card from another tableau and ensure it can be dropped to tab0
        const c = game.tableaux[1]!.peek()!;
        const canDrop = (game as any).previewDrop_(c, tab0);
        expect(canDrop).toBe(true);
    });

    it("should build foundations up by suit starting with Ace", () => {
        consume(game.restart(42));

        const foundationClubs = game.foundations[0]!;
        expect(foundationClubs.length).toBe(0);

        // Try to drop non-Ace to empty foundation -> should be invalid
        const topCard = game.tableaux[0]!.peek()!;
        (topCard as any).rank = Rank.Two;
        (topCard as any).suit = Suit.Clubs;

        const canDropTwoOnEmpty = (game as any).previewDrop_(topCard, foundationClubs);
        expect(canDropTwoOnEmpty).toBe(false);

        // Try to drop Ace of Clubs onto empty foundation -> should be valid
        const aceCard = game.tableaux[1]!.peek()!;
        (aceCard as any).rank = Rank.Ace;
        (aceCard as any).suit = Suit.Clubs;

        const canDropAce = (game as any).previewDrop_(aceCard, foundationClubs);
        expect(canDropAce).toBe(true);

        // Manually push Ace of Clubs to foundation
        foundationClubs.push(aceCard);

        // Now try to drop 2 of Clubs onto Ace of Clubs foundation -> should be valid
        const twoClubs = game.tableaux[2]!.peek()!;
        (twoClubs as any).rank = Rank.Two;
        (twoClubs as any).suit = Suit.Clubs;

        const canDropTwo = (game as any).previewDrop_(twoClubs, foundationClubs);
        expect(canDropTwo).toBe(true);

        // Try to drop 2 of Diamonds onto Clubs foundation -> should be invalid
        const twoDiamonds = game.tableaux[3]!.peek()!;
        (twoDiamonds as any).rank = Rank.Two;
        (twoDiamonds as any).suit = Suit.Diamonds;

        const canDropWrongSuit = (game as any).previewDrop_(twoDiamonds, foundationClubs);
        expect(canDropWrongSuit).toBe(false);
    });

    it("should be won when all foundations are built up to King", () => {
        consume(game.restart(42));

        expect(game.won).toBe(false);

        // Put all 52 cards manually into foundations
        const suits = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades];
        const ranks = [
            Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
            Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King
        ];

        let foundationIndex = 0;
        for (const suit of suits) {
            const foundation = game.foundations[foundationIndex]!;
            for (const rank of ranks) {
                // Find card
                const card = game.cards.find(c => c.suit === suit && c.rank === rank)!;
                foundation.push(card);
            }
            foundationIndex++;
        }

        (game as any).checkWon_();
        expect(game.won).toBe(true);
    });
});
