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
    public readonly stock = new Pile(this);
    public readonly waste = new Pile(this);
    public readonly foundations: Pile[] = [];
    public readonly reserves: Pile[] = [];
    private readonly dragSingleSources_: Pile[] = [];
    private readonly autoMoveSources_: Pile[] = [];

    constructor(options: GameOptions) {
        super();

        this.options = options;
        this.piles.push(this.stock);
        this.piles.push(this.waste);
        this.dragSingleSources_.push(this.waste);
        this.autoMoveSources_.push(this.waste);

        for (let i = 0; i < 4; ++i) {
            const pile = new Pile(this);
            this.foundations.push(pile);
            this.piles.push(pile);
        }

        for (let i = 0; i < 4; ++i) {
            const pile = new Pile(this);
            this.reserves.push(pile);
            this.dragSingleSources_.push(pile);
            this.autoMoveSources_.push(pile);
            this.piles.push(pile);
        }

        this.cards = DeckUtils.createStandard52Deck(this.stock);
    }

    public get baseRank(): Rank {
        const startCard = this.foundations[0]?.at(0);
        return startCard ? startCard.rank : Rank.None;
    }

    public getFoundationSuit(index: number): Suit {
        const pile = this.foundations[index];
        if (!pile || pile.length === 0) {
            return Suit.None;
        }
        return pile.at(0).suit;
    }

    protected doGetWon_() {
        let sum = 0;
        for (const pile of this.foundations) {
            sum += pile.length;
        }
        return sum === 52;
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

    protected *restart_(rng: prand.RandomGenerator) {
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

        for (let i = 0; i < 4; ++i) {
            const pile = this.reserves[i] ?? Debug.error();
            for (let j = 0; j < 4; ++j) {
                const card = this.stock.peek();
                if (card) {
                    pile.push(card);
                    card.faceUp = (j === 3);
                    yield DelayHint.Quick;
                }
            }
        }

        const firstFoundation = this.foundations[0] ?? Debug.error();
        const startCard = this.stock.peek();
        if (startCard) {
            firstFoundation.push(startCard);
            startCard.faceUp = true;
            yield DelayHint.Quick;
        }

        yield DelayHint.OneByOne;

        yield* this.doAutoMoves_();
    }

    protected *cardPrimary_(card: Card) {
        if (this.stock.peek() === card && this.canDrawFromStock_()) {
            yield* this.doDrawFromStock_();
            yield* this.doAutoMoves_();
            return;
        }

        if (this.reserves.indexOf(card.pile) >= 0) {
            if (card.pile.peek() === card && !card.faceUp) {
                card.faceUp = true;
                yield DelayHint.OneByOne;
                yield* this.doAutoMoves_();
                return;
            }
        }
    }

    protected *cardSecondary_(card: Card) {
        if (this.isFoundationDropSource_(card)) {
            for (const foundation of this.foundations) {
                if (this.isFoundationDrop_(card, foundation)) {
                    const sourcePile = card.pile;
                    foundation.push(card);
                    if (sourcePile === this.waste) {
                        this.waste.maxFan--;
                    }
                    yield DelayHint.OneByOne;
                    yield* this.doAutoMoves_();
                    return;
                }
            }
        }
    }

    protected *pilePrimary_(pile: Pile) {
        if (
            pile === this.stock &&
            this.stock.length === 0 &&
            this.waste.length > 0
        ) {
            this.waste.maxFan = 0;
            yield DelayHint.OneByOne;
            for (let i = this.waste.length; i-- > 0; ) {
                const card = this.waste.at(i);
                card.faceUp = false;
                this.stock.push(card);
            }
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
            return;
        }
    }

    protected *pileSecondary_(pile: Pile) {}

    protected canDrag_(card: Card): { canDrag: boolean; extraCards: Card[] } {
        if (this.isFoundationDropSource_(card)) {
            return { canDrag: true, extraCards: [] };
        }
        return { canDrag: false, extraCards: [] };
    }

    protected previewDrop_(card: Card, pile: Pile): boolean {
        return this.isFoundationDrop_(card, pile);
    }

    protected *dropCard_(card: Card, pile: Pile) {
        if (this.isFoundationDrop_(card, pile)) {
            const sourcePile = card.pile;
            pile.push(card);
            if (sourcePile === this.waste) {
                this.waste.maxFan--;
            }
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
        }
    }

    private canDrawFromStock_() {
        return this.stock.length > 0;
    }

    private *doDrawFromStock_() {
        this.waste.maxFan = 0;

        for (let i = 0; i < this.options.stockDraws; ++i) {
            const card = this.stock.peek();
            if (card) {
                this.waste.push(card);
                this.waste.maxFan++;
                yield DelayHint.Quick;
                card.faceUp = true;
                if (i < this.options.stockDraws - 1) {
                    yield DelayHint.Quick;
                }
            }
        }

        yield DelayHint.OneByOne;
    }

    private isFoundationDrop_(card: Card, pile: Pile): boolean {
        if (card.pile === pile) return false;

        const index = this.foundations.indexOf(pile);
        if (index < 0) return false;

        if (!this.isFoundationDropSource_(card)) return false;

        const bRank = this.baseRank;
        if (bRank === Rank.None) return false;

        if (pile.length === 0) {
            if (card.rank !== bRank) return false;

            for (let i = 0; i < 4; ++i) {
                if (i !== index && this.getFoundationSuit(i) === card.suit) {
                    return false;
                }
            }

            if (index > 0 && this.getFoundationSuit(index - 1) === Suit.None) {
                return false;
            }

            return true;
        } else {
            const fSuit = this.getFoundationSuit(index);
            if (card.suit !== fSuit) return false;

            if (index > 0) {
                const aboveFoundation = this.foundations[index - 1];
                let hasSameRank = false;
                for (let i = 0; i < aboveFoundation.length; ++i) {
                    if (aboveFoundation.at(i).rank === card.rank) {
                        hasSameRank = true;
                        break;
                    }
                }
                if (!hasSameRank) return false;
            }

            for (let i = 0; i < pile.length; ++i) {
                if (pile.at(i).rank === card.rank) {
                    return false;
                }
            }

            return true;
        }
    }

    private isFoundationDropSource_(card: Card): boolean {
        return (card.pile === this.waste || this.reserves.indexOf(card.pile) >= 0) && card.pile.peek() === card && card.faceUp;
    }

    private *doAutoMoves_() {
        mainLoop: while (true) {
            if (this.options.autoReveal) {
                for (const reserve of this.reserves) {
                    const card = reserve.peek();
                    if (card && !card.faceUp) {
                        card.faceUp = true;
                        yield DelayHint.OneByOne;
                        continue mainLoop;
                    }
                }
            }
            break;
        }
    }
}
