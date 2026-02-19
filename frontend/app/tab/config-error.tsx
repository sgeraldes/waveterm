import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import { atoms } from "@/store/global";
import { useAtomValue } from "jotai";

const ConfigErrorMessage = () => {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);

    if (fullConfig?.configerrors == null || fullConfig?.configerrors.length == 0) {
        return (
            <div className="max-w-[500px] p-5">
                <h3 className="font-bold text-base mb-2.5">Configuration Clean</h3>
                <p>There are no longer any errors detected in your config.</p>
            </div>
        );
    }
    if (fullConfig?.configerrors.length == 1) {
        const singleError = fullConfig.configerrors[0];
        return (
            <div className="max-w-[500px] p-5">
                <h3 className="font-bold text-base mb-2.5">Configuration Error</h3>
                <div>
                    {singleError.file}: {singleError.err}
                </div>
            </div>
        );
    }
    return (
        <div className="max-w-[500px] p-5">
            <h3 className="font-bold text-base mb-2.5">Configuration Error</h3>
            <ul>
                {fullConfig.configerrors.map((error, index) => (
                    <li key={index}>
                        {error.file}: {error.err}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export const ConfigErrorIcon = ({ buttonRef }: { buttonRef: React.RefObject<HTMLElement> }) => {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);

    function handleClick() {
        modalsModel.pushModal("MessageModal", { children: <ConfigErrorMessage /> });
    }

    if (fullConfig?.configerrors == null || fullConfig?.configerrors.length == 0) {
        return null;
    }
    return (
        <Button
            ref={buttonRef as React.RefObject<HTMLButtonElement>}
            className="text-black flex-[0_0_fit-content] !h-full !px-3 red"
            onClick={handleClick}
        >
            <i className="fa fa-solid fa-exclamation-triangle" />
            Config Error
        </Button>
    );
};
