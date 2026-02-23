import { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { WOS } from "@/store/global";
import * as jotai from "jotai";
import { TermHistoryView } from "./termhistory";

export class TermHistoryViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string | IconButtonDecl>;
    viewName: jotai.Atom<string>;
    viewText: jotai.Atom<string>;
    noPadding: jotai.PrimitiveAtom<boolean>;
    viewComponent: ViewComponent;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "termhistory";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId));
        this.viewIcon = jotai.atom("clock-rotate-left");
        this.viewName = jotai.atom("Session History");
        this.viewText = jotai.atom((get) => {
            const block = get(this.blockAtom);
            return block?.meta?.["cmd:cwd"] ?? "";
        });
        this.noPadding = jotai.atom<boolean>(true);
        this.viewComponent = TermHistoryView as ViewComponent;
    }
}
