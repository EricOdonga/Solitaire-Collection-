import { IGameInfo } from "~CardLib/IGameInfo";
import { GamePresenterFactory } from "./Presenter/GamePresenterFactory";

class GameInfo implements IGameInfo {
    public gameId = "blackhole";
    public gameName = "Black Hole";
    public gamePresenterFactory = new GamePresenterFactory();
}

export default new GameInfo();
