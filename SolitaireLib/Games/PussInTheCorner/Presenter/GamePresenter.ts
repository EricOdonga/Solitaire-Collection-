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
    private readonly foundationPiles_: PileView[] = [];
    private readonly cornerPiles_: PileView[] = [];

    protected get saveDataKey_() {
        return JSON.stringify({
            gameName: "pussinthecorner",
            version: 0,
            options: this.game_.options.saveKey,
        });
    }

    constructor(game: IGame, rootView: IView) {
        super(game, rootView);

        this.updateSizes_();

        // create stock pile:
        {
            const pileView = this.createPileView_(game.stock);
            pileView.showFrame = true;
            this.stockPile_ = pileView;
        }

        // create foundations:
        for (let i = 0; i < 4; ++i) {
            const pileView = this.createPileView_(game.foundations[i] ?? error());
            pileView.showFrame = true;
            pileView.zIndex = 100 + i;
            this.foundationPiles_.push(pileView);
        }

        // create corner piles:
        for (let i = 0; i < 4; ++i) {
            const pileView = this.createPileView_(game.corners[i] ?? error());
            pileView.showFrame = true;
            pileView.zIndex = 500 + i;
            this.cornerPiles_.push(pileView);
        }

        // create cards:
        for (const card of game.cards) {
            this.createCardView_(card);
        }

        this.layoutPiles_();
        this.relayoutAll_();
    }

    private updateSizes_() {
        const { sizeX, sizeY } = this.calculateCardSize(5, margin);
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
        const scaledMargin = margin * scale;

        const xPos = (factor: number) => factor * (this.sizeX + scaledMargin);
        const yPos = (factor: number) => factor * (this.sizeY + scaledMargin);

        // Stock at center left (column -2.5)
        {
            const pileView = this.stockPile_;
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(-2.5), yPos(0));
        }

        // Foundations in a 2x2 grid in the center
        const foundationPositions = [
            { x: -0.5, y: -0.5 },
            { x: 0.5, y: -0.5 },
            { x: -0.5, y: 0.5 },
            { x: 0.5, y: 0.5 }
        ];
        for (let i = 0; i < 4; ++i) {
            const pos = foundationPositions[i] ?? error();
            const pileView = this.foundationPiles_[i] ?? error();
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(pos.x), yPos(pos.y));
        }

        // Corners in a wider square around the foundations
        const cornerPositions = [
            { x: -1.5, y: -1.5 },
            { x: 1.5, y: -1.5 },
            { x: -1.5, y: 1.5 },
            { x: 1.5, y: 1.5 }
        ];
        for (let i = 0; i < 4; ++i) {
            const pos = cornerPositions[i] ?? error();
            const pileView = this.cornerPiles_[i] ?? error();
            pileView.rect = new Rect(this.sizeX, this.sizeY, xPos(pos.x), yPos(pos.y));
        }
    }
}
