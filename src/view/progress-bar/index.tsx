import { Footer } from "../footer";

/** フローティング進捗バー（左下固定） */
export const ProgressBar = () => {
  return (
    <div className="fixed bottom-3 left-3 z-[100] min-w-[300px] max-w-[600px] rounded-xl border border-[#2a2a3a] bg-[#1c1c24]/95 px-3 py-2 backdrop-blur-sm">
      <Footer />
    </div>
  );
};
