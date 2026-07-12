import * as MathEx from "~CardLib/MathEx";
import { GameOptionsBase } from "~CardLib/Model/GameOptionsBase";
import * as URLSearchParamsEx from "~CardLib/URLSearchParamsEx";

export class GameOptions extends GameOptionsBase {
    public stockDraws = 3;
    public autoReveal = true;

    public get saveKey() {
        return {
            stockDraws: this.stockDraws,
        };
    }

    constructor(params: URLSearchParams) {
        super();
        this.stockDraws = MathEx.clamp(URLSearchParamsEx.getNumber(params, "stockDraws", 3), 1, 5);
        this.autoReveal = URLSearchParamsEx.getBool(params, "autoReveal", true);
    }

    public toURLSearchParams(): URLSearchParams {
        const params = new URLSearchParams();
        URLSearchParamsEx.setNumber(params, "stockDraws", this.stockDraws, 3);
        URLSearchParamsEx.setBool(params, "autoReveal", this.autoReveal, true);
        return params;
    }
}
