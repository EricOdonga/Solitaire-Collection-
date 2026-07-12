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
    public readonly tableaux: Pile[] = [];
    public readonly foundations: Pile[] = [];

    constructor(options: GameOptions) {
        super();

        this.options = options;

        // Register piles in the exact layout order (indices 0 to 10)
        // Stacks 0 to 6: Tableau piles
        for (let i = 0; i < 7; ++i) {
            const pile = new Pile(this);
            this.tableaux.push(pile);
            this.piles.push(pile);
        }

        // Stacks 7 to 10: Foundation piles
        for (let i = 0; i < 4; ++i) {
            const pile = new Pile(this);
            this.foundations.push(pile);
            this.piles.push(pile);
        }

        // Create standard 52-card deck and place them initially in the first tableau
        this.cards = DeckUtils.createStandard52Deck(this.tableaux[0] ?? Debug.error());
    }

    protected doGetWon_() {
        // won when all 52 cards are in the foundation piles
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
        // Use a new, unregistered Pile as a temporary container instead of an active pile to avoid self-pushing issues.
        const tempPile = new Pile(this);

        // Gather all cards back to the temporary pile
        for (const pile of this.piles) {
            for (let i = pile.length; i-- > 0; ) {
                const card = pile.at(i);
                card.faceUp = false;
                tempPile.push(card);
            }
        }

        for (const card of tempPile) {
            card.faceUp = false;
        }

        tempPile.sort();
        tempPile.shuffle(rng);

        yield DelayHint.Settle;

        // Deal 52 cards face up and face down according to Russian Solitaire rules:
        // One 52-card deck, no stock or waste pile.
        // Deal 7 tableau columns with 1, 2, 3, 4, 5, 6, 7 cards respectively (the same triangular count as Klondike),
        // with only the top card of each column face up and the rest face down.
        // Then deal 4 additional face-up cards onto each of the 6 rightmost columns (columns 2 through 7 in 1-based, or indices 1 through 6 in 0-based),
        // on top of the existing cards in those columns.
        // Let's implement this deal step-by-step or in a simple loop:
        // First, the initial triangular count:
        // Column i has i face down cards, and 1 face up card on top.
        // Second, columns 1 to 6 get 4 more face up cards.
        // So for each column i from 0 to 6:
        // - Column 0 gets 0 face down, 1 face up.
        // - Column i (i >= 1) gets i face down, 1 face up + 4 face up = 5 face up cards.
        for (let i = 0; i < 7; ++i) {
            const pile = this.tableaux[i] ?? Debug.error();
            const faceDownCount = i;
            const faceUpCount = i === 0 ? 1 : 5;

            for (let j = 0; j < faceDownCount; ++j) {
                const card = tempPile.peek();
                if (card) {
                    card.faceUp = false;
                    pile.push(card);
                    yield DelayHint.Quick;
                }
            }

            for (let j = 0; j < faceUpCount; ++j) {
                const card = tempPile.peek();
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
        // If the player clicks a top card on the tableaux that is face down, reveal it:
        if (this.tableaux.indexOf(card.pile) >= 0) {
            if (card.pile.peek() === card && !card.faceUp) {
                card.faceUp = true;
                yield DelayHint.OneByOne;
                yield* this.doAutoMoves_();
                return;
            }
        }
    }

    protected *cardSecondary_(card: Card) {
        // Double-click -> auto-move to foundations
        if (this.tableaux.indexOf(card.pile) >= 0) {
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

    protected *pilePrimary_(pile: Pile) {}

    protected *pileSecondary_(pile: Pile) {}

    protected canDrag_(card: Card): { canDrag: boolean; extraCards: Card[] } {
        if (!card.faceUp) return { canDrag: false, extraCards: [] };

        if (this.tableaux.indexOf(card.pile) >= 0) {
            // "Any group of face-up cards can be moved together as a unit regardless of sequence"
            // So any face-up card in a tableau pile can be dragged along with all cards above it.
            return { canDrag: true, extraCards: card.pile.slice(card.pileIndex + 1) };
        } else if (this.foundations.indexOf(card.pile) >= 0) {
            // Drag the top card from a foundation pile
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
        if (this.previewDrop_(card, pile)) {
            const movingCards = [card, ...this.canDrag_(card).extraCards];
            for (const movingCard of movingCards) {
                pile.push(movingCard);
            }
            yield DelayHint.OneByOne;
            yield* this.doAutoMoves_();
        }
    }

    private isTableauDrop_(card: Card, pile: Pile): boolean {
        if (card.pile === pile) return false;
        if (this.tableaux.indexOf(pile) < 0) return false;

        const dragResult = this.canDrag_(card);
        if (!dragResult.canDrag) return false;

        const topCard = pile.peek();
        if (topCard) {
            // Strictly build down by suit (same suit, one value lower - e.g. Only 6 of Spades on 7 of Spades)
            return topCard.suit === card.suit && this.getCardValue_(topCard) === this.getCardValue_(card) + 1;
        } else {
            // Empty tableau slots can only be filled by Kings (or sequence headed by a King)
            return card.rank === Rank.King;
        }
    }

    private isFoundationDrop_(card: Card, pile: Pile): boolean {
        if (card.pile === pile) return false;
        if (this.foundations.indexOf(pile) < 0) return false;

        const dragResult = this.canDrag_(card);
        // Only single card can be moved to foundations
        if (!dragResult.canDrag || dragResult.extraCards.length > 0) return false;

        const topCard = pile.peek();
        if (topCard) {
            return this.getCardValue_(topCard) + 1 === this.getCardValue_(card) && topCard.suit === card.suit;
        } else {
            return card.rank === Rank.Ace;
        }
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
}
