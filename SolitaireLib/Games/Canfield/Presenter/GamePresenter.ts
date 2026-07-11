import { error } from "~CardLib/Debug";
import { GamePresenterBase } from "~CardLib/Presenter/GamePresenterBase";
import { IView } from "~CardLib/View/IView";
import { PileView } from "~CardLib/View/PileView";
import { Rect } from "~CardLib/View/Rect";
import { IGame } from "../Model/IGame";

export class GamePresenter extends GamePresenterBase<IGame> {
    private sizeY = 20;
    private sizeX = 20 / 1.555555555555;

    private readonly tableauPiles_: PileView[] = [];
    private readonly reservePile_: PileView;
    private readonly foundationPiles_: PileView[] = [];
    private readonly wastePiles_: PileView[] = [];
    private readonly stockPile_: PileView;

    protected get saveDataKey_() {
        return JSON.stringify({
            gameName: "canfield",
            version: 0,
            options: this.game_.options.saveKey,
        });
    }

    constructor(game: IGame, rootView: IView) {
        super(game, rootView);

        this.updateSizes_();

        // create piles:
        for (let i = 0; i < this.game_.tableaux.length; ++i) {
            const pileView = this.createPileView_(game.tableaux[i] ?? error());
            pileView.showFrame = true;
            pileView.zIndex = 800;
            this.tableauPiles_.push(pileView);
        }

        {
            const pileView = this.createPileView_(game.reserve);
            pileView.showFrame = true;
            pileView.zIndex = 800;
            this.reservePile_ = pileView;
        }

        for (let i = 0; i < this.game_.foundations.length; ++i) {
            const pileView = this.createPileView_(game.foundations[i] ?? error());
            pileView.showFrame = true;
            pileView.zIndex = 800;
            this.foundationPiles_.push(pileView);
        }

        {
            const pileView = this.createPileView_(game.waste9);
            pileView.showFrame = true;
            pileView.zIndex = 50;
            this.wastePiles_.push(pileView);
        }
        {
            const pileView = this.createPileView_(game.waste10);
            pileView.showFrame = true;
            pileView.zIndex = 50;
            this.wastePiles_.push(pileView);
        }
        {
            const pileView = this.createPileView_(game.waste11);
            pileView.showFrame = true;
            pileView.zIndex = 50;
            this.wastePiles_.push(pileView);
        }

        {
            const pileView = this.createPileView_(game.stock);
            pileView.showFrame = true;
            this.stockPile_ = pileView;
        }

        // create cards:
        for (const card of game.cards) {
            this.createCardView_(card);
        }

        this.layoutPiles_();
        this.relayoutAll_();
    }

    private updateSizes_() {
        const { sizeX, sizeY } = this.calculateCardSize(7, 1);
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

        let vExpand = 1;
        if (window.matchMedia("screen and (max-aspect-ratio: 100/130)").matches) {
            vExpand = 1.5;
        }

        const scale = this.sizeY / 20;
        const scaledMargin = 1 * scale;

        const xPos = (colIndex: number) => {
            return (colIndex - 0.5 * (tableSize - 1)) * (this.sizeX + scaledMargin);
        };

        const topY = vExpand * -35 * scale + scaledMargin;
        const bottomY = topY + this.sizeY + scaledMargin * 2;

        // Row 1 (Foundations + Waste + Stock):
        // Foundations 5-8 are grouped horizontally starting from the left edge:
        for (let i = 0; i < this.game_.foundations.length; ++i) {
            const pile = this.game_.foundations[i] ?? error();
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(i), topY);
        }

        // Trash/Waste piles 9-11 and Stock 12 are grouped on the upper right side:
        const wastePiles = [this.game_.waste9, this.game_.waste10, this.game_.waste11];
        const wasteColOffsets = [4.0, 4.6, 5.2];
        for (let i = 0; i < wastePiles.length; ++i) {
            const pile = wastePiles[i] ?? error();
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(wasteColOffsets[i] ?? 4.0), topY);
        }

        {
            const pile = this.game_.stock;
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(6.0), topY);
        }

        // Row 2:
        // Reserve stack 4 is positioned on the left side, directly below the foundation row:
        {
            const pile = this.game_.reserve;
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(0), bottomY);
        }

        // Tableau stacks 0-3 are positioned horizontally next to the Reserve stack, sitting under the foundations:
        for (let i = 0; i < this.game_.tableaux.length; ++i) {
            const pile = this.game_.tableaux[i] ?? error();
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(i + 1), bottomY);
            pileView.fanYDown = 3.5 * scale;
            pileView.fanYUp = vExpand * 3.5 * scale;
        }
    }
}
