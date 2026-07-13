import prand from "pure-rand";
import * as Debug from "~CardLib/Debug";
import { Card } from "~CardLib/Model/Card";
import * as DeckUtils from "~CardLib/Model/DeckUtils";
import { DelayHint } from "~CardLib/Model/DelayHint";
import { GameBase } from "~CardLib/Model/GameBase";
import { Pile } from "~CardLib/Model/Pile";
import { Rank } from "~CardLib/Model/Rank";
import { Suit } from "~CardLib/Model/Suit";
import { GameOptions } from "./GameOptions";
import { IGame } from "./IGame";

export class Game extends GameBase implements IGame {
    public readonly options: GameOptions;
    public readonly stock: Pile = new Pile(this);
    public readonly waste: Pile = new Pile(this);
    public readonly foundations: Pile[] = [];
    public readonly quilt: Pile[][] = [];
    private readonly quiltCoords_ = new Map<Pile, { r: number; c: number }>();
    private restocks_ = 0;

    constructor(options: GameOptions) {
        super();

        this.options = options;
        this.piles.push(this.stock);
        this.piles.push(this.waste);

        // Foundations: first 4 build up, next 4 build down
        for (let i = 0; i < 8; ++i) {
            const pile = new Pile(this);
            this.foundations.push(pile);
            this.piles.push(pile);
        }

        // Quilt: 8x8 grid of piles
        for (let r = 0; r < 8; ++r) {
            const row: Pile[] = [];
            for (let c = 0; c < 8; ++c) {
                const pile = new Pile(this);
                row.push(pile);
                this.quiltCoords_.set(pile, { r, c });
                this.piles.push(pile);
            }
            this.quilt.push(row);
        }

        // 104 cards total (2 standard decks)
        this.cards = [
            ...DeckUtils.createStandard52Deck(this.stock),
            ...DeckUtils.createStandard52Deck(this.stock),
        ];
    }

    protected doGetWon_() {
        let sum = 0;
        for (const pile of this.foundations) {
            sum += pile.length;
        }
        return sum === 104;
    }

    public get wonCards() {
        const wonCards: Card[] = [];
        for (const pile of this.foundations) {
            for (const card of pile) {
                wonCards.push(card);
            }
        }
        wonCards.sort((a, b) => {
            if (a.pileIndex > b.pileIndex) return 1;
            if (a.pileIndex < b.pileIndex) return -1;
            if (a.rank > b.rank) return 1;
            if (a.rank < b.rank) return -1;
            return 0;
        });
        return wonCards;
    }

    protected *restart_(rng: prand.RandomGenerator): Generator<DelayHint, void> {
        this.restocks_ = 0;

        // Reset all cards to stock face-down
        for (const card of this.stock) {
            card.faceUp = false;
        }

        for (let pileIndex = this.piles.length; pileIndex-- > 0; ) {
            const pile = this.piles[pileIndex] ?? Debug.error();
            if (pile === this.stock) continue;
            for (let cardIndex = pile.length; cardIndex-- > 0; ) {
                const card = pile.at(cardIndex);
                card.faceUp = false;
                this.stock.push(card);
            }
        }

        this.stock.sort();
        this.stock.shuffle(rng);

        yield DelayHint.Settle;

        // Seed foundations: 4 Aces (build-up) and 4 Kings (build-down)
        const upFoundationsSeeded = [false, false, false, false];
        const downFoundationsSeeded = [false, false, false, false];
        const suitsList = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];

        const toSeed: { card: Card; targetPile: Pile }[] = [];
        for (let i = 0; i < this.stock.length; ++i) {
            const card = this.stock.at(i);
            if (card.rank === Rank.Ace) {
                const sIndex = suitsList.indexOf(card.suit);
                if (sIndex >= 0 && !upFoundationsSeeded[sIndex]) {
                    upFoundationsSeeded[sIndex] = true;
                    const targetPile = this.foundations[sIndex] ?? Debug.error();
                    toSeed.push({ card, targetPile });
                }
            } else if (card.rank === Rank.King) {
                const sIndex = suitsList.indexOf(card.suit);
                if (sIndex >= 0 && !downFoundationsSeeded[sIndex]) {
                    downFoundationsSeeded[sIndex] = true;
                    const targetPile = this.foundations[4 + sIndex] ?? Debug.error();
                    toSeed.push({ card, targetPile });
                }
            }
        }

        for (const seed of toSeed) {
            seed.targetPile.push(seed.card);
            seed.card.faceUp = true;
            yield DelayHint.Quick;
        }

        // Deal 64 cards face up into the 8x8 quilt grid
        for (let r = 0; r < 8; ++r) {
            for (let c = 0; c < 8; ++c) {
                const card = this.stock.peek();
                if (card) {
                    const row = this.quilt[r] ?? Debug.error();
                    const pile = row[c] ?? Debug.error();
                    pile.push(card);
                    card.faceUp = true;
                    yield DelayHint.Quick;
                }
            }
        }

        yield DelayHint.OneByOne;

        yield* this.doAutoMoves_();
    }

    protected *cardPrimary_(card: Card): Generator<DelayHint, void> {
        // If player clicks the top card of the stock, draw it to waste
        if (this.stock.peek() === card && this.canDrawFromStock_()) {
            yield* this.doDrawFromStock_();
            yield* this.doAutoMoves_();
            return;
        }

        // Check if the card can move to any foundation
        if (this.isQuiltCardFree_(card) || card.pile === this.waste) {
            for (const foundation of this.foundations) {
                if (this.isFoundationDrop_(card, foundation)) {
                    yield* this.doFoundationDrop_(card, foundation);
                    yield* this.doAutoMoves_();
                    return;
                }
            }
        }

        // Check if a free quilt card can move to waste
        if (this.isQuiltCardFree_(card)) {
            if (this.isWasteDrop_(card, this.waste)) {
                yield* this.doWasteDrop_(card, this.waste);
                yield* this.doAutoMoves_();
                return;
            }
        }
    }

    protected *cardSecondary_(card: Card): Generator<DelayHint, void> {
        yield* this.cardPrimary_(card);
    }

    protected *pilePrimary_(pile: Pile): Generator<DelayHint, void> {
        // If the stock is empty, click to restock (redeal)
        if (
            pile === this.stock &&
            this.stock.length === 0 &&
            this.waste.length > 0 &&
            this.restocks_ < this.options.restocksAllowed
        ) {
            this.restocks_++;
            for (let i = this.waste.length; i-- > 0; ) {
                const card = this.waste.at(i);
                card.faceUp = false;
            }
            yield DelayHint.OneByOne;
            for (let i = this.waste.length; i-- > 0; ) {
                const card = this.waste.at(i);
                this.stock.push(card);
            }
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
            return;
        }
    }

    protected *pileSecondary_(pile: Pile): Generator<DelayHint, void> {}

    protected canDrag_(card: Card): { canDrag: boolean; extraCards: Card[] } {
        if (card.pile === this.waste && this.waste.peek() === card) {
            return { canDrag: true, extraCards: [] };
        }
        if (this.quiltCoords_.has(card.pile) && this.isQuiltCardFree_(card)) {
            return { canDrag: true, extraCards: [] };
        }
        return { canDrag: false, extraCards: [] };
    }

    protected previewDrop_(card: Card, pile: Pile): boolean {
        return this.isFoundationDrop_(card, pile) || this.isWasteDrop_(card, pile);
    }

    protected *dropCard_(card: Card, pile: Pile): Generator<DelayHint, void> {
        if (this.isFoundationDrop_(card, pile)) {
            yield* this.doFoundationDrop_(card, pile);
            yield* this.doAutoMoves_();
        } else if (this.isWasteDrop_(card, pile)) {
            yield* this.doWasteDrop_(card, pile);
            yield* this.doAutoMoves_();
        }
    }

    private canDrawFromStock_() {
        return this.stock.length > 0;
    }

    private *doDrawFromStock_() {
        const card = this.stock.peek();
        if (card) {
            this.waste.push(card);
            card.faceUp = true;
            yield DelayHint.Quick;
        }
        yield DelayHint.OneByOne;
    }

    private isQuiltCardFree_(card: Card): boolean {
        const coords = this.quiltCoords_.get(card.pile);
        if (!coords) return false;

        // Quilt card must be the top card (though piles in quilt grid should only contain 1 card)
        if (card.pile.peek() !== card) return false;

        const { r, c } = coords;
        const isPortrait = (r + c) % 2 === 0;

        if (isPortrait) {
            const topRow = this.quilt[r - 1];
            const topPile = topRow ? topRow[c] : undefined;
            const topEmpty = !topPile || topPile.length === 0;

            const bottomRow = this.quilt[r + 1];
            const bottomPile = bottomRow ? bottomRow[c] : undefined;
            const bottomEmpty = !bottomPile || bottomPile.length === 0;

            return topEmpty || bottomEmpty;
        } else {
            const row = this.quilt[r];
            const leftPile = row ? row[c - 1] : undefined;
            const leftEmpty = !leftPile || leftPile.length === 0;

            const rightPile = row ? row[c + 1] : undefined;
            const rightEmpty = !rightPile || rightPile.length === 0;

            return leftEmpty || rightEmpty;
        }
    }

    private isFoundationDrop_(card: Card, foundation: Pile): boolean {
        if (card.pile === foundation) return false;

        const fIndex = this.foundations.indexOf(foundation);
        if (fIndex < 0) return false;

        const topCard = foundation.peek();
        if (!topCard) return false; // Seeded on start, but safety check

        if (fIndex < 4) {
            // Build UP (Ace -> King)
            return (
                card.suit === topCard.suit &&
                this.getCardValue_(card) === this.getCardValue_(topCard) + 1
            );
        } else {
            // Build DOWN (King -> Ace)
            return (
                card.suit === topCard.suit &&
                this.getCardValue_(card) === this.getCardValue_(topCard) - 1
            );
        }
    }

    private *doFoundationDrop_(card: Card, foundation: Pile) {
        foundation.push(card);
        yield DelayHint.OneByOne;
    }

    private isWasteDrop_(card: Card, waste: Pile): boolean {
        if (waste !== this.waste) return false;
        if (card.pile === this.waste) return false;

        const topCard = this.waste.peek();
        if (!topCard) return false; // Empty waste cannot be filled from the quilt

        return this.isWasteMatch_(card, topCard);
    }

    private *doWasteDrop_(card: Card, waste: Pile) {
        waste.push(card);
        yield DelayHint.OneByOne;
    }

    private isWasteMatch_(card: Card, wasteTop: Card): boolean {
        if (card.suit !== wasteTop.suit) return false;
        const v1 = this.getCardValue_(card);
        const v2 = this.getCardValue_(wasteTop);
        const diff = Math.abs(v1 - v2);
        return diff === 1 || diff === 12;
    }

    private getCardValue_(card: Card): number {
        switch (card.rank) {
            case Rank.Ace:
                return 1;
            case Rank.Two:
                return 2;
            case Rank.Three:
                return 3;
            case Rank.Four:
                return 4;
            case Rank.Five:
                return 5;
            case Rank.Six:
                return 6;
            case Rank.Seven:
                return 7;
            case Rank.Eight:
                return 8;
            case Rank.Nine:
                return 9;
            case Rank.Ten:
                return 10;
            case Rank.Jack:
                return 11;
            case Rank.Queen:
                return 12;
            case Rank.King:
                return 13;
            default:
                Debug.error();
        }
    }

    private *doAutoMoves_(): Generator<DelayHint, void> {
        mainLoop: while (true) {
            if (this.options.autoMoveToFoundation > 0) {
                // Check top card of waste
                const wasteTop = this.waste.peek();
                if (wasteTop) {
                    for (const foundation of this.foundations) {
                        if (this.isFoundationDrop_(wasteTop, foundation)) {
                            yield* this.doFoundationDrop_(wasteTop, foundation);
                            continue mainLoop;
                        }
                    }
                }

                // Check free quilt cards
                for (const row of this.quilt) {
                    for (const pile of row) {
                        const card = pile.peek();
                        if (card && this.isQuiltCardFree_(card)) {
                            for (const foundation of this.foundations) {
                                if (this.isFoundationDrop_(card, foundation)) {
                                    yield* this.doFoundationDrop_(card, foundation);
                                    continue mainLoop;
                                }
                            }
                        }
                    }
                }
            }
            break;
        }
    }
}
