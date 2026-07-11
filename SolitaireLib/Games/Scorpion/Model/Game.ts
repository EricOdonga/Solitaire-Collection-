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
    public readonly reserve = new Pile(this);
    public readonly foundations: Pile[] = [];
    public readonly tableaux: Pile[] = [];

    constructor(options: GameOptions) {
        super();

        this.options = options;

        // Tableaux piles (indices 0 to 6)
        for (let i = 0; i < 7; ++i) {
            const pile = new Pile(this);
            this.tableaux.push(pile);
            this.piles.push(pile);
        }

        // Foundation piles (indices 7 to 10)
        for (let i = 0; i < 4; ++i) {
            const pile = new Pile(this);
            this.foundations.push(pile);
            this.piles.push(pile);
        }

        // Reserve pile (index 11)
        this.piles.push(this.reserve);

        // Create standard 52 deck and place initially in the reserve pile
        this.cards = DeckUtils.createStandard52Deck(this.reserve);
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
        // Reset all cards to reserve face-down:
        for (const card of this.reserve) {
            card.faceUp = false;
        }

        for (let pileIndex = this.piles.length; pileIndex-- > 0; ) {
            const pile = this.piles[pileIndex] ?? Debug.error();
            if (pile === this.reserve) continue;
            for (let cardIndex = pile.length; cardIndex-- > 0; ) {
                const card = pile.at(cardIndex);
                card.faceUp = false;
                this.reserve.push(card);
            }
        }

        // Sort and shuffle:
        this.reserve.sort();
        this.reserve.shuffle(rng);

        yield DelayHint.Settle;

        // Deal 49 cards to tableaux:
        // First 4 columns: bottom 3 cards face down, remaining 4 face up
        // Last 3 columns: all 7 cards face up
        for (let i = 0; i < 7; ++i) {
            const pile = this.tableaux[i] ?? Debug.error();
            const faceDownCount = i < 4 ? 3 : 0;
            const faceUpCount = 7 - faceDownCount;

            for (let j = 0; j < faceDownCount; ++j) {
                const card = this.reserve.peek();
                if (card) {
                    card.faceUp = false;
                    pile.push(card);
                    yield DelayHint.Quick;
                }
            }

            for (let j = 0; j < faceUpCount; ++j) {
                const card = this.reserve.peek();
                if (card) {
                    card.faceUp = true;
                    pile.push(card);
                    yield DelayHint.Quick;
                }
            }
        }

        yield DelayHint.OneByOne;

        yield* this.doAutoMoves_();
    }

    protected *cardPrimary_(card: Card) {
        // Clicking reserve deals remaining 3 cards to first 3 columns
        if (card.pile === this.reserve && this.canDrawFromReserve_()) {
            yield* this.doDrawFromReserve_();
            yield* this.doAutoMoves_();
            return;
        }

        // Clicking top face-down card on tableaux reveals it
        if (this.tableaux.indexOf(card.pile) >= 0) {
            if (card.pile.peek() === card && !card.faceUp) {
                card.faceUp = true;
                yield DelayHint.OneByOne;
                yield* this.doAutoMoves_();
                return;
            }
        }
    }

    protected *cardSecondary_(card: Card) {}

    protected *pilePrimary_(pile: Pile) {
        if (pile === this.reserve && this.canDrawFromReserve_()) {
            yield* this.doDrawFromReserve_();
            yield* this.doAutoMoves_();
            return;
        }
    }

    protected *pileSecondary_(pile: Pile) {}

    protected canDrag_(card: Card): { canDrag: boolean; extraCards: Card[] } {
        if (!card.faceUp) return { canDrag: false, extraCards: [] };

        if (this.tableaux.indexOf(card.pile) >= 0) {
            // Any face-up card in tableau can be dragged, along with all cards on top of it
            return { canDrag: true, extraCards: card.pile.slice(card.pileIndex + 1) };
        }

        return { canDrag: false, extraCards: [] };
    }

    protected previewDrop_(card: Card, pile: Pile): boolean {
        return this.isTableauDrop_(card, pile);
    }

    protected *dropCard_(card: Card, pile: Pile) {
        if (this.isTableauDrop_(card, pile)) {
            const movingCards = [card, ...this.canDrag_(card).extraCards];
            for (const movingCard of movingCards) {
                pile.push(movingCard);
            }
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
        }
    }

    private canDrawFromReserve_() {
        return this.reserve.length === 3;
    }

    private *doDrawFromReserve_() {
        for (let i = 0; i < 3; ++i) {
            const card = this.reserve.peek();
            if (card) {
                const pile = this.tableaux[i] ?? Debug.error();
                pile.push(card);
                card.faceUp = true;
                yield DelayHint.Quick;
            }
        }
        yield DelayHint.OneByOne;
    }

    private isTableauDrop_(card: Card, pile: Pile): boolean {
        if (card.pile === pile) return false;
        if (this.tableaux.indexOf(pile) < 0) return false;

        const dragResult = this.canDrag_(card);
        if (!dragResult.canDrag) return false;

        const topCard = pile.peek();
        if (topCard) {
            // Build down by suit
            return topCard.suit === card.suit && this.getCardValue_(topCard) === this.getCardValue_(card) + 1;
        } else {
            // Empty tableau columns can only be filled by a King (or sequence headed by a King)
            return card.rank === Rank.King;
        }
    }

    private findCompleteSequenceIndex_(tableau: Pile): number {
        if (tableau.length < 13) return -1;
        // Search from top to bottom for a sequence King -> Ace of same suit
        for (let i = 0; i <= tableau.length - 13; ++i) {
            const startCard = tableau.at(i);
            if (!startCard || !startCard.faceUp || startCard.rank !== Rank.King) {
                continue;
            }
            const suit = startCard.suit;
            let valid = true;
            for (let j = 0; j < 13; ++j) {
                const card = tableau.at(i + j);
                if (!card || !card.faceUp || card.suit !== suit || this.getCardValue_(card) !== 13 - j) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                return i;
            }
        }
        return -1;
    }

    private findEmptyFoundation_(): Pile | undefined {
        for (const foundation of this.foundations) {
            if (foundation.length === 0) {
                return foundation;
            }
        }
        return undefined;
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
            if (this.options.autoReveal) {
                for (const tableau of this.tableaux) {
                    const card = tableau.peek();
                    if (card && !card.faceUp) {
                        card.faceUp = true;
                        yield DelayHint.OneByOne;
                        continue mainLoop;
                    }
                }
            }

            // Automove completed sequences to foundation
            for (const tableau of this.tableaux) {
                const seqStartIdx = this.findCompleteSequenceIndex_(tableau);
                if (seqStartIdx >= 0) {
                    const foundation = this.findEmptyFoundation_();
                    if (foundation) {
                        const movingCards = tableau.slice(seqStartIdx);
                        for (const card of movingCards) {
                            foundation.push(card);
                        }
                        yield DelayHint.OneByOne;
                        continue mainLoop;
                    }
                }
            }

            break;
        }
    }
}
