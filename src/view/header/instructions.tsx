import { Kbd } from "@/components/kbd";
import { useT } from "@/i18n/context";

export const Instructions = () => {
  const t = useT();

  return (
    <div>
      <div className="mb-2 border-b text-lg font-bold">{t("Mouse")}</div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div>Wheel</div>
        <div>{t("Zoom", "instructions.zoom")}</div>

        <div>Click</div>
        <div>{t("Zoom at clicked point")}</div>

        <div>LMB Drag</div>
        <div>{t("Change center")}</div>

        <div>RMB Drag</div>
        <div>{t("Interactive zoom and change center")}</div>
      </div>

      <div className="mb-2 border-b text-lg font-bold">{t("Keys")}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
        </div>
        <div>{t("Zoom", "instructions.zoom")}</div>

        <div>
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <Kbd>3</Kbd>
          <Kbd>4</Kbd>
          <Kbd>5</Kbd>
          <Kbd>6</Kbd>
          <Kbd>7</Kbd>
          <Kbd>8</Kbd>
        </div>
        <div>{t("Change Palette")}</div>

        <div>
          <Kbd>r</Kbd>
        </div>
        <div>{t("Reset r to 2.0")}</div>

        <div>
          <Kbd>s</Kbd>
        </div>
        <div>{t("Supersampling(x2) current location")}</div>

        <div>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </div>
        <div>{t("Change max iteration (±100)")}</div>

        <div>
          <Kbd>Shift</Kbd> + <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </div>
        <div>{t("Change max iteration wisely (maybe)")}</div>

        <div>
          <Kbd>9</Kbd>
        </div>
        <div>{t("Reset iteration count to 10000")}</div>

        <div>
          <Kbd>0</Kbd>
        </div>
        <div>{t("Reset iteration count to 500")}</div>
      </div>
    </div>
  );
};
