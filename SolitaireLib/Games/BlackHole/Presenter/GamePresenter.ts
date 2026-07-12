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

    private readonly foundationPile_: PileView;
    private readonly tableauPiles_: PileView[] = [];

    protected get saveDataKey_() {
        return JSON.stringify({
            gameName: "blackhole",
            version: 0,
            options: this.game_.options.saveKey,
        });
    }

    constructor(game: IGame, rootView: IView) {
        super(game, rootView);

        this.updateSizes_();

        // Central Foundation Pile:
        {
            const pileView = this.createPileView_(game.foundation);
            pileView.showFrame = true;
            pileView.zIndex = 50;
            this.foundationPile_ = pileView;
        }

        // 17 Tableau Piles:
        for (let i = 0; i < this.game_.tableaux.length; ++i) {
            const pileView = this.createPileView_(game.tableaux[i] ?? error());
            pileView.showFrame = true;
            pileView.zIndex = 800;
            this.tableauPiles_.push(pileView);
        }

        // create cards:
        for (const card of game.cards) {
            this.createCardView_(card);
        }

        this.layoutPiles_();
        this.relayoutAll_();
    }

    private updateSizes_() {
        // Since we lay out in a circle of radius ~3 * sizeX, passing 8 maxColumns fits perfectly.
        const { sizeX, sizeY } = this.calculateCardSize(8, margin);
        this.sizeX = sizeX;
        this.sizeY = sizeY;
    }

    protected onResize_() {
        this.updateSizes_();
        this.layoutPiles_();
        this.relayoutAll_();
    }

    private layoutPiles_() {
        const scale = this.sizeY / 20;

        let vExpand = 1;
        if (window.matchMedia("screen and (max-aspect-ratio: 100/130)").matches) {
            vExpand = 1.5;
        }

        const radiusX = this.sizeX * 3.0;
        const radiusY = this.sizeY * 1.8 * vExpand;

        // Central foundation pile
        {
            const pileView = this.foundationPile_;
            pileView.rect = new Rect(this.sizeX, this.sizeY, 0, 0);
        }

        // 17 Tableau piles in an ellipse
        for (let i = 0; i < this.game_.tableaux.length; ++i) {
            const angle = (i * 2 * Math.PI) / 17;
            const x = Math.sin(angle) * radiusX;
            const y = -Math.cos(angle) * radiusY;

            const pile = this.game_.tableaux[i] ?? error();
            const pileView = this.getPileView_(pile);
            pileView.rect = new Rect(this.sizeX, this.sizeY, x, y);
            pileView.fanYUp = 1.5 * scale;
            pileView.fanYDown = 1.5 * scale;
        }
    }
}
