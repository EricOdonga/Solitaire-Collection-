import prand from "pure-rand";
import * as Debug from "~CardLib/Debug";
import { Card } from "~CardLib/Model/Card";
import { Suit } from "~CardLib/Model/Suit";
import { Colour } from "~CardLib/Model/Colour";
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
    public readonly corners: Pile[] = [];

    private dealtThisRound_ = 0;
    private redeals_ = 0;

    constructor(options: GameOptions) {
        super();

        this.options = options;
        this.piles.push(this.stock);

        for (let i = 0; i < 4; ++i) {
            const pile = new Pile(this);
            this.foundations.push(pile);
            this.piles.push(pile);
        }

        for (let i = 0; i < 4; ++i) {
            const pile = new Pile(this);
            this.corners.push(pile);
            this.piles.push(pile);
        }

        this.cards = DeckUtils.createStandard52Deck(this.stock);
    }

    protected doGetWon_() {
        for (const pile of this.foundations) {
            if (pile.length !== 13) return false;
        }
        return true;
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
        this.dealtThisRound_ = 0;
        this.redeals_ = 0;

        for (const card of this.cards) {
            card.faceUp = false;
        }

        for (const pile of this.piles) {
            if (pile === this.stock) continue;
            for (let i = pile.length; i-- > 0; ) {
                const card = pile.at(i);
                card.faceUp = false;
                this.stock.push(card);
            }
        }

        this.stock.sort();
        this.stock.shuffle(rng);

        yield DelayHint.Settle;

        // Separate the 4 Aces and place them face up in the foundations
        const aces: Card[] = [];
        const suitsOrder = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
        for (const suit of suitsOrder) {
            for (let i = 0; i < this.stock.length; ++i) {
                const card = this.stock.at(i);
                if (card.rank === Rank.Ace && card.suit === suit) {
                    aces.push(card);
                    break;
                }
            }
        }

        for (let i = 0; i < 4; ++i) {
            const ace = aces[i] ?? Debug.error();
            const foundation = this.foundations[i] ?? Debug.error();
            foundation.push(ace);
            ace.faceUp = true;
        }

        yield DelayHint.Quick;

        yield* this.doAutoMoves_();
    }

    protected *cardPrimary_(card: Card) {}

    protected *cardSecondary_(card: Card) {
        if (this.corners.indexOf(card.pile) >= 0 && card.pile.peek() === card && card.faceUp) {
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
            if (this.stock.length > 0) {
                if (this.dealtThisRound_ >= 4) {
                    this.dealtThisRound_ = 0;
                    yield DelayHint.Quick;
                    yield* this.doAutoMoves_();
                }
            } else {
                if (this.redeals_ < 1) {
                    let totalCornerCards = 0;
                    for (const corner of this.corners) {
                        totalCornerCards += corner.length;
                    }

                    if (totalCornerCards > 0) {
                        this.redeals_++;
                        this.dealtThisRound_ = 0;
                        for (const corner of this.corners) {
                            for (let i = corner.length; i-- > 0; ) {
                                const card = corner.at(i);
                                card.faceUp = false;
                                this.stock.push(card);
                            }
                        }
                        yield DelayHint.OneByOne;
                        yield* this.doAutoMoves_();
                    }
                }
            }
        }
    }

    protected *pileSecondary_(pile: Pile) {}

    protected canDrag_(card: Card): { canDrag: boolean; extraCards: Card[] } {
        if (!card.faceUp) return { canDrag: false, extraCards: [] };

        if (card.pile === this.stock) {
            if (this.stock.peek() === card && this.dealtThisRound_ < 4) {
                return { canDrag: true, extraCards: [] };
            }
        } else if (this.corners.indexOf(card.pile) >= 0) {
            if (card.pile.peek() === card) {
                return { canDrag: true, extraCards: [] };
            }
        }

        return { canDrag: false, extraCards: [] };
    }

    protected previewDrop_(card: Card, pile: Pile): boolean {
        if (card.pile === pile) return false;

        if (card.pile === this.stock) {
            return this.corners.indexOf(pile) >= 0 && this.dealtThisRound_ < 4;
        }

        if (this.corners.indexOf(card.pile) >= 0) {
            return this.isFoundationDrop_(card, pile);
        }

        return false;
    }

    protected *dropCard_(card: Card, pile: Pile) {
        if (card.pile === this.stock && this.corners.indexOf(pile) >= 0) {
            pile.push(card);
            this.dealtThisRound_++;
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
        } else if (this.corners.indexOf(card.pile) >= 0 && this.isFoundationDrop_(card, pile)) {
            pile.push(card);
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
        }
    }

    private isFoundationDrop_(card: Card, foundation: Pile): boolean {
        if (card.pile === foundation) return false;
        if (this.foundations.indexOf(foundation) < 0) return false;

        const topCard = foundation.peek();
        if (!topCard) return false;

        if (topCard.colour !== card.colour) return false;

        const topVal = this.getCardValue_(topCard);
        const cardVal = this.getCardValue_(card);
        return cardVal === topVal + 1;
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
                return 0;
        }
    }

    private *doAutoMoves_() {
        mainLoop: while (true) {
            if (this.dealtThisRound_ < 4) {
                const card = this.stock.peek();
                if (card && !card.faceUp) {
                    card.faceUp = true;
                    yield DelayHint.OneByOne;
                    continue mainLoop;
                }
            }
            break;
        }
    }

    public override serialize() {
        const baseJson = super.serialize();
        const customData = {
            dealtThisRound: this.dealtThisRound_,
            redeals: this.redeals_
        };
        return JSON.stringify({ baseJson, customData });
    }

    public override deserialize(json: string) {
        try {
            const data = JSON.parse(json);
            if (data && typeof data === "object" && "baseJson" in data && "customData" in data) {
                if (super.deserialize(data.baseJson)) {
                    this.dealtThisRound_ = data.customData.dealtThisRound;
                    this.redeals_ = data.customData.redeals;
                    return true;
                }
            }
        } catch {
            // fallback
        }
        return super.deserialize(json);
    }
}
