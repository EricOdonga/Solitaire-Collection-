import { describe, it, expect, beforeEach } from "vitest";
import { Game } from "./Game";
import { GameOptions } from "./GameOptions";
import { Suit } from "~CardLib/Model/Suit";
import { Colour } from "~CardLib/Model/Colour";
import { Rank } from "~CardLib/Model/Rank";
import { Pile } from "~CardLib/Model/Pile";

describe("LaBelleLucie Game Model", () => {
    let game: Game;

    const clearAllPiles = (g: Game) => {
        g.cards = [];
        const tempPile = new Pile(g);
        for (const p of g.piles) {
            while (p.length > 0) {
                tempPile.push(p.peek()!);
            }
        }
    };

    beforeEach(() => {
        const params = new URLSearchParams("autoMoveToFoundation=0");
        game = new Game(new GameOptions(params));
    });

    it("should initialize correctly", () => {
        expect(game.tableaux.length).toBe(18);
        expect(game.foundations.length).toBe(4);
        expect(game.stock).toBeDefined();
        expect(game.cards.length).toBe(52);
    });

    it("should deal cards correctly on restart (17 fans of 3, 1 fan of 1)", () => {
        const restartGen = game.restart(12345);
        let result = restartGen.next();
        while (!result.done) {
            result = restartGen.next();
        }

        for (let i = 0; i < 17; ++i) {
            expect(game.tableaux[i].length).toBe(3);
        }
        expect(game.tableaux[17].length).toBe(1);

        for (const card of game.cards) {
            expect(card.faceUp).toBe(true);
        }

        for (const fd of game.foundations) {
            expect(fd.length).toBe(0);
        }

        expect(game.redealsRemaining).toBe(2);
    });

    it("should build down in suit only", () => {
        clearAllPiles(game);

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1];

        const s7 = t0.createCard(Suit.Spades, Colour.Black, Rank.Seven);
        s7.faceUp = true;
        game.cards.push(s7);

        const s6 = t1.createCard(Suit.Spades, Colour.Black, Rank.Six);
        s6.faceUp = true;
        game.cards.push(s6);

        // Can drop s6 onto s7 (same suit, building down)
        expect(game.previewDrop(s6, t0)).toBe(true);

        const h6 = t1.createCard(Suit.Hearts, Colour.Red, Rank.Six);
        h6.faceUp = true;
        game.cards.push(h6);

        // Cannot drop h6 onto s7 (different suit)
        expect(game.previewDrop(h6, t0)).toBe(false);
    });

    it("should drag top card only", () => {
        clearAllPiles(game);

        const t0 = game.tableaux[0];

        const s7 = t0.createCard(Suit.Spades, Colour.Black, Rank.Seven);
        s7.faceUp = true;
        game.cards.push(s7);

        const s6 = t0.createCard(Suit.Spades, Colour.Black, Rank.Six);
        s6.faceUp = true;
        game.cards.push(s6);

        // Can drag top card (s6)
        expect(game.canDrag(s6).canDrag).toBe(true);
        expect(game.canDrag(s6).extraCards.length).toBe(0);

        // Cannot drag s7 (buried)
        expect(game.canDrag(s7).canDrag).toBe(false);
    });

    it("should never allow refilling empty columns", () => {
        clearAllPiles(game);

        const t0 = game.tableaux[0];
        const t1 = game.tableaux[1]; // empty

        const s7 = t0.createCard(Suit.Spades, Colour.Black, Rank.Seven);
        s7.faceUp = true;
        game.cards.push(s7);

        // Cannot drop onto empty column t1
        expect(game.previewDrop(s7, t1)).toBe(false);
    });

    it("should allow exactly 2 redeals and deal remaining cards in fans of 3", () => {
        const restartGen = game.restart(12345);
        let result = restartGen.next();
        while (!result.done) {
            result = restartGen.next();
        }

        expect(game.redealsRemaining).toBe(2);

        // Move 2 cards from tableaux to foundations to reduce remaining cards to 50
        // Find Spades Ace and Spades Two
        let sAce: any = null;
        let sTwo: any = null;
        for (const card of game.cards) {
            if (card.suit === Suit.Spades && card.rank === Rank.Ace) {
                sAce = card;
            }
            if (card.suit === Suit.Spades && card.rank === Rank.Two) {
                sTwo = card;
            }
        }

        // Manually place them on foundation[0]
        const fd0 = game.foundations[0];
        fd0.push(sAce);
        fd0.push(sTwo);

        // Remaining tableau cards = 50.
        // Trigger first redeal by clicking stock
        const redealGen1 = game.pilePrimary(game.stock);
        let res1 = redealGen1.next();
        while (!res1.done) {
            res1 = redealGen1.next();
        }

        expect(game.redealsRemaining).toBe(1);

        // 50 cards should be dealt into:
        // 16 fans of 3 cards (48 cards) + 1 fan of 2 cards = 17 fans total.
        for (let i = 0; i < 16; ++i) {
            expect(game.tableaux[i].length).toBe(3);
        }
        expect(game.tableaux[16].length).toBe(2);
        expect(game.tableaux[17].length).toBe(0);

        // Trigger second redeal
        const redealGen2 = game.pilePrimary(game.stock);
        let res2 = redealGen2.next();
        while (!res2.done) {
            res2 = redealGen2.next();
        }

        expect(game.redealsRemaining).toBe(0);

        // Trigger third click on stock - should do nothing (since 0 redeals left)
        const redealGen3 = game.pilePrimary(game.stock);
        let res3 = redealGen3.next();
        while (!res3.done) {
            res3 = redealGen3.next();
        }

        expect(game.redealsRemaining).toBe(0);
    });

    it("should reach won condition when all 52 cards are in foundations", () => {
        clearAllPiles(game);
        expect(game.won).toBe(false);

        for (let f = 0; f < 4; ++f) {
            const fd = game.foundations[f];
            const suit = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs][f]!;
            const colour = [Colour.Black, Colour.Red, Colour.Red, Colour.Black][f]!;
            const ranks = [
                Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
                Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King
            ];
            for (const r of ranks) {
                const card = fd.createCard(suit, colour, r);
                card.faceUp = true;
                game.cards.push(card);
            }
        }

        expect((game as any).doGetWon_()).toBe(true);
    });
});
