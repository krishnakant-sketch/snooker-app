import Image from "next/image";
import SnookerTableManager from "./Snookertablemanager";

export default function Home() {
  return (
    // <div className="flex min-h-screen flex-col items-center justify-between p-24">
    //   <h1 className="text-4xl font-bold">Welcome to the Snooker App!</h1>
      <SnookerTableManager/>
    //   <p className="mt-4 text-lg text-gray-600">
    //     This is a simple application to manage your snooker games and scores.
    //   </p>
    // </div>
  );
}
