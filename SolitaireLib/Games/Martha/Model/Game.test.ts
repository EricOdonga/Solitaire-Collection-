import { describe, it, expect, beforeEach } from "vitest";
import { Game } from "./Game";
import { GameOptions } from "./GameOptions";
import { Rank } from "~CardLib/Model/Rank";
import { Colour } from "~CardLib/Model/Colour";
import { Suit } from "~CardLib/Model/Suit";
import { Pile } from "~CardLib/Model/Pile";

describe("Martha Game Model", () => {
    let game: Game;

    const runGenerator = (gen: Generator<any, any, any>) => {
        while (!gen.next().done) {}
    };

    beforeEach(() => {
        game = new Game(new GameOptions(new URLSearchParams("autoReveal=false&autoMoveToFoundation=0")));
    });

    it("should initialize correctly with empty piles", () => {
        expect(game.foundations.length).toBe(4);
        expect(game.tableaux.length).toBe(12);
        expect((game as any).stock).toBeUndefined();
        expect((game as any).waste).toBeUndefined();
    });

    it("should produce a deterministic deal with a fixed seed", () => {
        const game1 = new Game(new GameOptions(new URLSearchParams("autoReveal=false&autoMoveToFoundation=0")));
        runGenerator(game1.restart(12345));

        const game2 = new Game(new GameOptions(new URLSearchParams("autoReveal=false&autoMoveToFoundation=0")));
        runGenerator(game2.restart(12345));

        expect(game1.tableaux.length).toBe(game2.tableaux.length);
        for (let i = 0; i < game1.tableaux.length; ++i) {
            const pile1 = game1.tableaux[i]!;
            const pile2 = game2.tableaux[i]!;
            expect(pile1.length).toBe(pile2.length);
            for (let j = 0; j < pile1.length; ++j) {
                expect(pile1.at(j).suit).toBe(pile2.at(j).suit);
                expect(pile1.at(j).rank).toBe(pile2.at(j).rank);
                expect(pile1.at(j).faceUp).toBe(pile2.at(j).faceUp);
            }
        }
    });

    it("should place 4 Aces as starting cards in foundations on deal", () => {
        runGenerator(game.restart(54321));

        // 4 foundations must each have 1 card, which is an Ace
        for (const f of game.foundations) {
            expect(f.length).toBe(1);
            expect(f.peek()?.rank).toBe(Rank.Ace);
            expect(f.peek()?.faceUp).toBe(true);
        }
    });

    it("should deal remaining 48 cards into 12 tableaux alternating face-down/face-up", () => {
        runGenerator(game.restart(999));

        for (const t of game.tableaux) {
            expect(t.length).toBe(4);
            // 1st card (index 0) dealt face-down
            expect(t.at(0).faceUp).toBe(false);
            // 2nd card (index 1) face-up
            expect(t.at(1).faceUp).toBe(true);
            // 3rd card (index 2) face-down
            expect(t.at(2).faceUp).toBe(false);
            // 4th/top card (index 3) face-up
            expect(t.at(3).faceUp).toBe(true);
        }
    });

    it("should reject multi-card sequence drops on empty tableaux", () => {
        runGenerator(game.restart(111));

        const t0 = game.tableaux[0]!;
        const t1 = game.tableaux[1]!;

        const tempTrash = new Pile(game);

        // Move all cards from t1 to tempTrash safely
        while (t1.length > 0) {
            tempTrash.push(t1.peek()!);
        }
        expect(t1.length).toBe(0);

        // Safely clear t0
        while (t0.length > 0) {
            tempTrash.push(t0.peek()!);
        }

        const redKing = game.cards.find(c => c.rank === Rank.King && c.colour === Colour.Red)!;
        const blackQueen = game.cards.find(c => c.rank === Rank.Queen && c.colour === Colour.Black)!;

        redKing.faceUp = true;
        blackQueen.faceUp = true;
        t0.push(redKing);
        t0.push(blackQueen);

        // Try to move both Red King and Black Queen to empty t1
        const dragResult = (game as any).canDrag_(redKing);
        expect(dragResult.canDrag).toBe(true);
        expect(dragResult.extraCards.length).toBe(1); // blackQueen is extra card

        const canDropSeq = (game as any).previewDrop_(redKing, t1);
        expect(canDropSeq).toBe(false); // multi-card sequence drop on empty is rejected

        // Try to move only Black Queen (single card) to empty t1
        const dragResultSingle = (game as any).canDrag_(blackQueen);
        expect(dragResultSingle.canDrag).toBe(true);
        expect(dragResultSingle.extraCards.length).toBe(0);

        const canDropSingle = (game as any).previewDrop_(blackQueen, t1);
        expect(canDropSingle).toBe(true); // single card drop on empty is allowed
    });

    it("should support sequence moves building down by alternating color", () => {
        runGenerator(game.restart(222));

        const t0 = game.tableaux[0]!;
        const t1 = game.tableaux[1]!;

        const tempTrash = new Pile(game);
        while (t0.length > 0) {
            tempTrash.push(t0.peek()!);
        }
        while (t1.length > 0) {
            tempTrash.push(t1.peek()!);
        }

        const blackJack = game.cards.find(c => c.rank === Rank.Jack && c.colour === Colour.Black)!;
        const redTen = game.cards.find(c => c.rank === Rank.Ten && c.colour === Colour.Red)!;
        const blackNine = game.cards.find(c => c.rank === Rank.Nine && c.colour === Colour.Black)!;

        blackJack.faceUp = true;
        redTen.faceUp = true;
        blackNine.faceUp = true;

        t0.push(blackJack);
        t0.push(redTen);
        t0.push(blackNine);

        const redQueen = game.cards.find(c => c.rank === Rank.Queen && c.colour === Colour.Red)!;
        redQueen.faceUp = true;
        t1.push(redQueen);

        // We should be able to drag blackJack, redTen, blackNine together and drop them on redQueen
        const dragResult = (game as any).canDrag_(blackJack);
        expect(dragResult.canDrag).toBe(true);
        expect(dragResult.extraCards.length).toBe(2);

        const canDrop = (game as any).previewDrop_(blackJack, t1);
        expect(canDrop).toBe(true); // Black Jack can drop on Red Queen
    });

    it("should correctly handle foundation drops and win state", () => {
        runGenerator(game.restart(333));

        expect(game.won).toBe(false);

        // Safe clearing of tableaux and foundations
        const tempTrash = new Pile(game);
        for (const pile of game.tableaux) {
            while (pile.length > 0) {
                tempTrash.push(pile.peek()!);
            }
        }

        // Place Ace to Queen on foundations
        for (let i = 0; i < 4; ++i) {
            const f = game.foundations[i]!;
            while (f.length > 0) {
                tempTrash.push(f.peek()!);
            }
            const suit = i === 0 ? Suit.Spades : i === 1 ? Suit.Hearts : i === 2 ? Suit.Diamonds : Suit.Clubs;

            // Fill foundation with Ace through Queen of that suit
            const ranks = [
                Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
                Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen
            ];
            for (const rank of ranks) {
                const card = game.cards.find(c => c.suit === suit && c.rank === rank)!;
                card.faceUp = true;
                f.push(card);
            }
        }

        // Put the 4 Kings in tableaux
        const kings = game.cards.filter(c => c.rank === Rank.King);
        expect(kings.length).toBe(4);
        for (let i = 0; i < 4; ++i) {
            const king = kings[i]!;
            king.faceUp = true;
            game.tableaux[i]!.push(king);
        }

        expect(game.won).toBe(false);

        // Drop each King onto its respective foundation
        for (let i = 0; i < 4; ++i) {
            const king = kings[i]!;
            const f = game.foundations.find(found => found.peek()?.suit === king.suit)!;
            const canDrop = game.previewDrop(king, f);
            expect(canDrop).toBe(true);

            // Execute the drop high-level generator
            runGenerator(game.dropCard(king, f));
        }

        // Check won
        expect(game.won).toBe(true);
    });
});
