/**
 * Graybox placeholder props for the desk surface. Simple flat shapes only —
 * real illustration comes later, once the OS interaction model is validated.
 */
export default function DeskProps() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      {/* Coffee mug */}
      <div
        className="absolute bottom-[6.2%] left-[16%] h-[3.4vh] w-[3vw] rounded-b-md rounded-t-sm border-2 border-stone-900/60 bg-orange-200"
        style={{ transform: "perspective(600px) rotateX(45deg)" }}
      />

      {/* Books */}
      <div
        className="absolute bottom-[6%] left-[8%] flex w-[6vw] flex-col-reverse gap-[2px]"
        style={{ transform: "perspective(600px) rotateX(45deg)" }}
      >
        <div className="h-[1.6vh] rounded-sm border-2 border-stone-900/60 bg-teal-800" />
        <div className="h-[1.6vh] w-[5vw] rounded-sm border-2 border-stone-900/60 bg-amber-700" />
        <div className="h-[1.6vh] w-[5.5vw] rounded-sm border-2 border-stone-900/60 bg-rose-800" />
      </div>

      {/* Lamp */}
      <div className="absolute right-[10%] bottom-[9%] flex w-[6vw] flex-col items-end">
        <div className="h-[8vh] w-[0.6vw] rounded-full bg-stone-700" />
        <div
          className="h-[3vh] w-[6vw] rounded-t-full border-2 border-stone-900/60 bg-stone-300"
          style={{ marginTop: "-1vh" }}
        />
      </div>

      {/* Plant */}
      <div className="absolute bottom-[6%] left-[85%] flex w-[5vw] flex-col items-center">
        <div className="flex gap-1">
          <div className="h-[5vh] w-[1.4vw] -rotate-12 rounded-full bg-teal-700" />
          <div className="h-[6vh] w-[1.4vw] rounded-full bg-teal-600" />
          <div className="h-[5vh] w-[1.4vw] rotate-12 rounded-full bg-teal-700" />
        </div>
        <div className="h-[2.4vh] w-[4vw] rounded-b-md border-2 border-stone-900/60 bg-orange-300" />
      </div>
    </div>
  );
}
