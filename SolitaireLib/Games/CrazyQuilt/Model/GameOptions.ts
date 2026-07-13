import * as MathEx from "~CardLib/MathEx";
import { GameOptionsBase } from "~CardLib/Model/GameOptionsBase";
import * as URLSearchParamsEx from "~CardLib/URLSearchParamsEx";

export class GameOptions extends GameOptionsBase {
    public restocksAllowed = 1;
    public autoMoveToFoundation = 1;

    public get saveKey() {
        return {
            restocksAllowed: this.restocksAllowed,
            autoMoveToFoundation: this.autoMoveToFoundation,
        };
    }

    constructor(params: URLSearchParams) {
        super();
        this.restocksAllowed = URLSearchParamsEx.getNumber(params, "restocksAllowed", 1);
        this.autoMoveToFoundation = Math.max(0, URLSearchParamsEx.getNumber(params, "autoMoveToFoundation", 1));
    }

    public toURLSearchParams(): URLSearchParams {
        const params = new URLSearchParams();
        URLSearchParamsEx.setNumber(params, "restocksAllowed", this.restocksAllowed, 1);
        URLSearchParamsEx.setNumber(params, "autoMoveToFoundation", this.autoMoveToFoundation, 1);
        return params;
    }
}
