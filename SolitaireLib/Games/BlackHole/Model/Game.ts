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
    public readonly foundation = new Pile(this);
    public readonly tableaux: Pile[] = [];

    constructor(options: GameOptions) {
        super();
        this.options = options;

        this.piles.push(this.foundation);
        for (let i = 0; i < 17; ++i) {
            const pile = new Pile(this);
            this.tableaux.push(pile);
            this.piles.push(pile);
        }

        this.cards = DeckUtils.createStandard52Deck(this.foundation);
    }

    protected doGetWon_() {
        return this.foundation.length === 52;
    }

    public get wonCards() {
        return [...this.foundation];
    }

    protected *restart_(rng: prand.RandomGenerator) {
        // Reset faceUp on all cards to false and return all cards to the foundation pile
        for (const card of this.foundation) {
            card.faceUp = false;
        }
        for (let pileIndex = this.piles.length; pileIndex-- > 0; ) {
            const pile = this.piles[pileIndex] ?? Debug.error();
            if (pile === this.foundation) continue;
            for (let cardIndex = pile.length; cardIndex-- > 0; ) {
                const card = pile.at(cardIndex);
                card.faceUp = false;
                this.foundation.push(card);
            }
        }

        // Sort then shuffle the foundation pile:
        this.foundation.sort();
        this.foundation.shuffle(rng);

        yield DelayHint.Settle;

        // Find the Ace of Spades card
        let aceOfSpades: Card | undefined;
        for (let i = 0; i < this.foundation.length; ++i) {
            const card = this.foundation.at(i);
            if (card.suit === Suit.Spades && card.rank === Rank.Ace) {
                aceOfSpades = card;
                break;
            }
        }
        if (!aceOfSpades) Debug.error("Ace of Spades not found!");

        // Move the Ace of Spades to index 0 (bottom) of the foundation,
        // so that it will be at the bottom of the foundation pile.
        this.foundation.insert(0, aceOfSpades);

        // Deal 51 cards to 17 tableaux, 3 cards each.
        // We push cards from the top of the foundation pile.
        for (const tableau of this.tableaux) {
            for (let j = 0; j < 3; ++j) {
                const card = this.foundation.peek();
                if (card && card !== aceOfSpades) {
                    tableau.push(card);
                    card.faceUp = true;
                    yield DelayHint.Quick;
                }
            }
        }

        // Ensure the Ace of Spades is face up
        aceOfSpades.faceUp = true;

        yield DelayHint.OneByOne;
    }

    protected *cardPrimary_(card: Card) {
        if (this.tableaux.indexOf(card.pile) >= 0 && card.pile.peek() === card) {
            if (this.isFoundationDrop_(card, this.foundation)) {
                this.foundation.push(card);
                yield DelayHint.OneByOne;
            }
        }
    }

    protected *cardSecondary_(card: Card) {
        yield* this.cardPrimary_(card);
    }

    protected *pilePrimary_(pile: Pile) {}
    protected *pileSecondary_(pile: Pile) {}

    protected canDrag_(card: Card): { canDrag: boolean; extraCards: Card[] } {
        const isTop = this.tableaux.indexOf(card.pile) >= 0 && card.pile.peek() === card;
        return { canDrag: isTop, extraCards: [] };
    }

    protected previewDrop_(card: Card, pile: Pile): boolean {
        return this.isFoundationDrop_(card, pile);
    }

    protected *dropCard_(card: Card, pile: Pile) {
        if (this.isFoundationDrop_(card, pile)) {
            pile.push(card);
            yield DelayHint.OneByOne;
        }
    }

    private isFoundationDrop_(card: Card, pile: Pile) {
        if (pile !== this.foundation) return false;
        if (card.pile === pile) return false;

        if (this.tableaux.indexOf(card.pile) < 0) return false;
        if (card.pile.peek() !== card) return false;

        const topCard = pile.peek();
        if (!topCard) return false;

        const v1 = this.getCardValue_(topCard);
        const v2 = this.getCardValue_(card);
        const diff = Math.abs(v1 - v2);
        return diff === 1 || diff === 12;
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
}
