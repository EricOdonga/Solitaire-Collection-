import * as MathEx from "~CardLib/MathEx";
import { GameOptionsBase } from "~CardLib/Model/GameOptionsBase";
import * as URLSearchParamsEx from "~CardLib/URLSearchParamsEx";

export class GameOptions extends GameOptionsBase {
    public restocksAllowed = 1; // Default to 1 recycle (2 passes)
    public autoReveal = true;
    public autoPlayStock = true;
    public autoMoveToFoundation = 2;

    public get saveKey() {
        return {
            restocksAllowed: this.restocksAllowed,
        };
    }

    constructor(params: URLSearchParams) {
        super();
        this.restocksAllowed = URLSearchParamsEx.getNumber(params, "restocksAllowed", 1);
        this.autoReveal = URLSearchParamsEx.getBool(params, "autoReveal", true);
        this.autoPlayStock = URLSearchParamsEx.getBool(params, "autoPlayStock", true);
        this.autoMoveToFoundation = Math.max(0, URLSearchParamsEx.getNumber(params, "autoMoveToFoundation", 2));
    }

    public toURLSearchParams(): URLSearchParams {
        const params = new URLSearchParams();
        URLSearchParamsEx.setNumber(params, "restocksAllowed", this.restocksAllowed, 1);
        URLSearchParamsEx.setBool(params, "autoReveal", this.autoReveal, true);
        URLSearchParamsEx.setBool(params, "autoPlayStock", this.autoPlayStock, true);
        URLSearchParamsEx.setNumber(params, "autoMoveToFoundation", this.autoMoveToFoundation, 2);
        return params;
    }
}
