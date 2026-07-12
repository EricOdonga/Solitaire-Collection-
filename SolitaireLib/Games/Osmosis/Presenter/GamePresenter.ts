import { error } from "~CardLib/Debug";
import { GamePresenterBase } from "~CardLib/Presenter/GamePresenterBase";
import { IView } from "~CardLib/View/IView";
import { PileView } from "~CardLib/View/PileView";
import { Rect } from "~CardLib/View/Rect";
import { IGame } from "../Model/IGame";

const margin = 1;

export class GamePresenter extends GamePresenterBase<IGame> {
    private sizeY = 20;
    private sizeX = 20 / 1.555555555555;

    private readonly stockPile_: PileView;
    private readonly wastePile_: PileView;
    private readonly foundationPiles_: PileView[] = [];
    private readonly reservePiles_: PileView[] = [];

    protected get saveDataKey_() {
        return JSON.stringify({
            gameName: "osmosis",
            version: 0,
            options: this.game_.options.saveKey,
        });
    }

    constructor(game: IGame, rootView: IView) {
        super(game, rootView);

        this.updateSizes_();

        // create stock pile view:
        {
            const pileView = this.createPileView_(game.stock);
            pileView.showFrame = true;
            this.stockPile_ = pileView;
        }

        // create waste pile view:
        {
            const pileView = this.createPileView_(game.waste);
            pileView.showFrame = true;
            pileView.zIndex = 50;
            this.wastePile_ = pileView;
        }

        // create foundation pile views:
        for (let i = 0; i < this.game_.foundations.length; ++i) {
            const pileView = this.createPileView_(game.foundations[i] ?? error());
            pileView.showFrame = true;
            pileView.zIndex = 800;
            this.foundationPiles_.push(pileView);
        }

        // create reserve pile views:
        for (let i = 0; i < this.game_.reserves.length; ++i) {
            const pileView = this.createPileView_(game.reserves[i] ?? error());
            pileView.showFrame = true;
            pileView.zIndex = 800;
            this.reservePiles_.push(pileView);
        }

        // create card views:
        for (const card of game.cards) {
            this.createCardView_(card);
        }

        this.layoutPiles_();
        this.relayoutAll_();
    }

    private updateSizes_() {
        const { sizeX, sizeY } = this.calculateCardSize(7, margin);
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }

    protected onResize_() {
        this.updateSizes_();
        this.layoutPiles_();
        this.relayoutAll_();
    }

    private layoutPiles_() {
        const tableSize = 7;
        const scale = this.sizeY / 20;
        const scaledMargin = margin * scale;

        const xPos = (i: number) => {
            return (i - 0.5 * (tableSize - 1)) * (this.sizeX + scaledMargin);
        };

        const rowCount = 5;
        const yPos = (r: number) => {
            return (r - 0.5 * (rowCount - 1)) * (this.sizeY + scaledMargin);
        };

        // Stock at row 0, col 0
        {
            const pileView = this.stockPile_;
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(0), yPos(0));
        }

        // Waste at row 0, col 1
        {
            const pileView = this.wastePile_;
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(1), yPos(0));
            pileView.fanXUp = 3 * scale;
        }

        // Reserves at rows 1 to 4, col 0
        for (let i = 0; i < this.game_.reserves.length; ++i) {
            const pile = this.game_.reserves[i] ?? error();
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(0), yPos(i + 1));
        }

        // Foundations at rows 1 to 4, col 1 fanned to the right
        for (let i = 0; i < this.game_.foundations.length; ++i) {
            const pile = this.game_.foundations[i] ?? error();
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(1), yPos(i + 1));
            pileView.fanXUp = 2.5 * scale;
        }
    }
}
