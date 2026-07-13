import prand from "pure-rand";
import * as Debug from "~CardLib/Debug";
import { Card } from "~CardLib/Model/Card";
import * as DeckUtils from "~CardLib/Model/DeckUtils";
import { DelayHint } from "~CardLib/Model/DelayHint";
import { GameBase } from "~CardLib/Model/GameBase";
import { Pile } from "~CardLib/Model/Pile";
import { Rank } from "~CardLib/Model/Rank";
import { GameOptions } from "./GameOptions";
import { IGame } from "./IGame";

export class Game extends GameBase implements IGame {
    public readonly options: GameOptions;
    public readonly stock = new Pile(this);
    public readonly foundations: Pile[] = [];
    public readonly tableaux: Pile[] = [];
    private redealsRemaining_ = 2;

    public get redealsRemaining() {
        return this.redealsRemaining_;
    }

    constructor(options: GameOptions) {
        super();

        this.options = options;
        this.piles.push(this.stock);

        // 4 foundations
        for (let i = 0; i < 4; ++i) {
            const pile = new Pile(this);
            this.foundations.push(pile);
            this.piles.push(pile);
        }

        // 18 fan tableaux
        for (let i = 0; i < 18; ++i) {
            const pile = new Pile(this);
            this.tableaux.push(pile);
            this.piles.push(pile);
        }

        this.cards = DeckUtils.createStandard52Deck(this.stock);
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
        this.redealsRemaining_ = 2;

        // put all cards back into the stock, face down
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

        // sort then shuffle the stock
        this.stock.sort();
        this.stock.shuffle(rng);

        yield DelayHint.Settle;

        // Deal 52 cards into 18 tableaux
        // 17 fans of 3 cards each, and 1 fan of 1 card
        for (let i = 0; i < 18; ++i) {
            const tableau = this.tableaux[i] ?? Debug.error();
            const dealCount = i < 17 ? 3 : 1;
            for (let j = 0; j < dealCount; ++j) {
                const card = this.stock.peek();
                if (card) {
                    tableau.push(card);
                    card.faceUp = true;
                    yield DelayHint.Quick;
                }
            }
        }

        yield DelayHint.OneByOne;
        yield* this.doAutoMoves_();
    }

    protected *cardPrimary_(card: Card) {}

    protected *cardSecondary_(card: Card) {
        if (card.pile.peek() === card && card.faceUp) {
            for (const foundation of this.foundations) {
                if (this.isFoundationDrop_(card, foundation)) {
                    foundation.push(card);
                    yield DelayHint.OneByOne;
                    yield* this.doAutoMoves_();
                    return;
                }
            }
        }
    }

    protected *pilePrimary_(pile: Pile) {
        if (pile === this.stock) {
            if (this.redealsRemaining_ > 0) {
                yield* this.doRedeal_();
            }
        }
    }

    protected *pileSecondary_(pile: Pile) {}

    protected canDrag_(card: Card): { canDrag: boolean; extraCards: Card[] } {
        if (!card.faceUp) return { canDrag: false, extraCards: [] };

        // only the top card of a fan/tableau or foundation can be dragged
        if (this.tableaux.indexOf(card.pile) >= 0 || this.foundations.indexOf(card.pile) >= 0) {
            if (card.pile.peek() === card) {
                return { canDrag: true, extraCards: [] };
            }
        }

        return { canDrag: false, extraCards: [] };
    }

    protected previewDrop_(card: Card, pile: Pile): boolean {
        return this.isTableauDrop_(card, pile) || this.isFoundationDrop_(card, pile);
    }

    protected *dropCard_(card: Card, pile: Pile) {
        if (this.isTableauDrop_(card, pile)) {
            pile.push(card);
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
        } else if (this.isFoundationDrop_(card, pile)) {
            pile.push(card);
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
        }
    }

    private *doRedeal_() {
        // gather remaining cards in tableaux
        const remainingCards: Card[] = [];
        for (const tableau of this.tableaux) {
            for (let i = tableau.length; i-- > 0; ) {
                const card = tableau.at(i);
                card.faceUp = false;
                remainingCards.push(card);
            }
        }

        if (remainingCards.length === 0) return;

        this.redealsRemaining_--;

        for (const card of remainingCards) {
            this.stock.push(card);
        }

        yield DelayHint.OneByOne;

        // Shuffle the remaining cards
        const seed = Math.floor(Math.random() * 2147483647);
        const rng = prand.mersenne(seed);
        this.stock.sort();
        this.stock.shuffle(rng);

        let colIndex = 0;
        while (this.stock.length > 0) {
            const destTableau = this.tableaux[colIndex] ?? Debug.error();
            const dealCount = Math.min(3, this.stock.length);
            for (let j = 0; j < dealCount; ++j) {
                const card = this.stock.peek();
                if (card) {
                    destTableau.push(card);
                    card.faceUp = true;
                }
            }
            colIndex++;
            yield DelayHint.Quick;
        }

        yield DelayHint.OneByOne;
        yield* this.doAutoMoves_();
    }

    private isFoundationDrop_(card: Card, pile: Pile): boolean {
        if (card.pile === pile) return false;
        if (this.foundations.indexOf(pile) < 0) return false;

        const dragResult = this.canDrag_(card);
        if (!dragResult.canDrag) return false;

        const topCard = pile.peek();
        if (topCard) {
            return this.getCardValue_(topCard) + 1 === this.getCardValue_(card) && topCard.suit === card.suit;
        } else {
            return card.rank === Rank.Ace;
        }
    }

    private isTableauDrop_(card: Card, pile: Pile): boolean {
        if (card.pile === pile) return false;
        if (this.tableaux.indexOf(pile) < 0) return false;

        const dragResult = this.canDrag_(card);
        if (!dragResult.canDrag) return false;

        const topCard = pile.peek();
        if (!topCard) {
            // Once a fan becomes completely empty, it is gone permanently and cannot be refilled or recreated
            return false;
        }

        return topCard.suit === card.suit && this.getCardValue_(topCard) === this.getCardValue_(card) + 1;
    }

    private getCardValue_(card: Card) {
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

    private *doAutoMoves_() {
        mainLoop: while (true) {
            if (this.options.autoMoveToFoundation > 0) {
                let foundationMin = 999;
                for (const pile of this.foundations) {
                    const card = pile.peek();
                    if (card) {
                        foundationMin = Math.min(foundationMin, this.getCardValue_(card));
                    } else {
                        foundationMin = Math.min(foundationMin, 0);
                    }
                }

                for (const pile of this.tableaux) {
                    const card = pile.peek();
                    if (card && this.getCardValue_(card) <= foundationMin + this.options.autoMoveToFoundation) {
                        for (const foundation of this.foundations) {
                            if (this.isFoundationDrop_(card, foundation)) {
                                foundation.push(card);
                                yield DelayHint.OneByOne;
                                continue mainLoop;
                            }
                        }
                    }
                }
            }

            break;
        }
    }

    public override serialize() {
        const baseJson = super.serialize();
        const customData = {
            redealsRemaining: this.redealsRemaining_
        };
        return JSON.stringify({ baseJson, customData });
    }

    public override deserialize(json: string) {
        try {
            const data = JSON.parse(json);
            if (data && typeof data === "object" && "baseJson" in data && "customData" in data) {
                if (super.deserialize(data.baseJson)) {
                    this.redealsRemaining_ = data.customData.redealsRemaining;
                    return true;
                }
            }
        } catch {
            // fallback
        }
        return super.deserialize(json);
    }
}
