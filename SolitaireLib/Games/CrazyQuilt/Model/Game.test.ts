import { describe, it, expect, beforeEach } from "vitest";
import { Game } from "./Game";
import { GameOptions } from "./GameOptions";
import { Suit } from "~CardLib/Model/Suit";
import { Rank } from "~CardLib/Model/Rank";

const runGenerator = (gen: Generator<any, any, any>) => {
    while (!gen.next().done) {}
};

describe("CrazyQuilt Game Model", () => {
    let game: Game;

    beforeEach(() => {
        // Disable auto moves for deterministic testing of layout and card movement
        const params = new URLSearchParams();
        params.set("autoMoveToFoundation", "0");
        game = new Game(new GameOptions(params));
    });

    it("should initialize correctly with standard properties", () => {
        expect(game.stock).toBeDefined();
        expect(game.waste).toBeDefined();
        expect(game.foundations.length).toBe(8);
        expect(game.quilt.length).toBe(8);
        expect(game.quilt[0]?.length).toBe(8);
    });

    it("should produce a deterministic deal and populate correctly after restart", () => {
        // Fully run restart generator to ensure all underlying state mutations execute
        runGenerator(game.restart(54321));

        // Stock has 104 - 8 seeds - 64 quilt cards = 32 cards
        expect(game.stock.length).toBe(32);

        // Waste is empty at start
        expect(game.waste.length).toBe(0);

        // Check seeded foundations
        // First 4 foundations should have one Ace of Spades, Hearts, Diamonds, Clubs
        const expectedUpSuits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
        for (let i = 0; i < 4; ++i) {
            const foundation = game.foundations[i];
            expect(foundation.length).toBe(1);
            const card = foundation.peek();
            expect(card?.rank).toBe(Rank.Ace);
            expect(card?.suit).toBe(expectedUpSuits[i]);
            expect(card?.faceUp).toBe(true);
        }

        // Next 4 foundations should have one King of Spades, Hearts, Diamonds, Clubs
        const expectedDownSuits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
        for (let i = 0; i < 4; ++i) {
            const foundation = game.foundations[4 + i];
            expect(foundation.length).toBe(1);
            const card = foundation.peek();
            expect(card?.rank).toBe(Rank.King);
            expect(card?.suit).toBe(expectedDownSuits[i]);
            expect(card?.faceUp).toBe(true);
        }

        // 8x8 quilt has exactly 1 card in each cell
        for (let r = 0; r < 8; ++r) {
            for (let c = 0; c < 8; ++c) {
                expect(game.quilt[r][c].length).toBe(1);
                expect(game.quilt[r][c].peek()?.faceUp).toBe(true);
            }
        }
    });

    it("should correctly evaluate quilt card availability based on neighboring empty cells or off-grid", () => {
        runGenerator(game.restart(12345));

        // (0, 0) is portrait -> short sides are top (off-grid) and bottom (Row 1).
        // Since top is off-grid, it should be available.
        const card00 = game.quilt[0][0].peek()!;
        expect((game as any).isQuiltCardFree_(card00)).toBe(true);

        // (0, 1) is landscape -> short sides are left (Col 0) and right (Col 2).
        // Row 0 Col 1 is at index 1. Col -1 is off-grid. So left side is off-grid.
        // Left side col 0 has a card. Right side col 2 has a card.
        // Therefore, (0, 1) should NOT be available since both neighbor cells (0,0) and (0,2) have cards!
        const card01 = game.quilt[0][1].peek()!;
        expect((game as any).isQuiltCardFree_(card01)).toBe(false);

        // Let's manually clear cell (0, 0) to make c=1 free on its left!
        game.waste.push(card00);
        expect(game.quilt[0][0].length).toBe(0);

        // Now cell (0, 1) left side (Col 0) is empty. So it should be available!
        expect((game as any).isQuiltCardFree_(card01)).toBe(true);
    });

    it("should correctly validate waste sequence matches with wrapping King and Ace", () => {
        runGenerator(game.restart(44444));

        // Find cards from game.cards (rather than stock, since some might be seeded or in quilt)
        const allCards = game.cards;
        const spadesAce = allCards.find(c => c.suit === Suit.Spades && c.rank === Rank.Ace)!;
        const spadesTwo = allCards.find(c => c.suit === Suit.Spades && c.rank === Rank.Two)!;
        const spadesKing = allCards.find(c => c.suit === Suit.Spades && c.rank === Rank.King)!;
        const spadesThree = allCards.find(c => c.suit === Suit.Spades && c.rank === Rank.Three)!;
        const heartsAce = allCards.find(c => c.suit === Suit.Hearts && c.rank === Rank.Ace)!;

        // Two should match Ace
        expect((game as any).isWasteMatch_(spadesTwo, spadesAce)).toBe(true);

        // King should match Ace (wrapping)
        expect((game as any).isWasteMatch_(spadesKing, spadesAce)).toBe(true);

        // Three should NOT match Ace
        expect((game as any).isWasteMatch_(spadesThree, spadesAce)).toBe(false);

        // Hearts Ace should NOT match Spades Ace (different suit)
        expect((game as any).isWasteMatch_(heartsAce, spadesAce)).toBe(false);
    });

    it("should detect win state correctly when all 104 cards are on foundations", () => {
        expect(game.won).toBe(false);

        // Mock win state: move all cards from stock, waste, quilt to foundations
        const cards = game.cards.slice();
        for (let i = 0; i < cards.length; ++i) {
            const card = cards[i];
            const fIndex = i % 8;
            game.foundations[fIndex].push(card);
        }

        // Force check won (since won is evaluated on higher-level operations or doGetWon_)
        expect((game as any).doGetWon_()).toBe(true);
    });
});
