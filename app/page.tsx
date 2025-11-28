// import Image from "next/image";

// export default function Home() {
//   return (
//     <main className="h-screen w-full flex flex-col justify-between items-center bg-white">
//       {/* Logo */}
//       <div className="pt-10">
//         <Image
//           src="/images/Mills Brand_logo (registered)-01.png" 
//           alt="Mills Brands Logo"
//           width={160}
//           height={60}
//           className="mx-auto"
//         />
//       </div>

//       {/* Center Icon and Text */}
//       <div className="flex flex-col items-center">
//         <div className="relative">
//           <Image
//             src="/images/click_collect.svg"
//             alt="Bags"
//             width={800}
//             height={1500}
//           />
//         </div>
//       </div>

//       {/* Touch to Start Button */}

//       <div className="w-full bg-gradient-to-r from-[#0070C9] to-[#004E9A] py-6 flex justify-center items-center text-white gap-3">
//         <Image
//           src="/images/hand.png"
//           alt="Touch Icon"
//           width={150}
//           height={150}
//           className="object-contain"
//         />
//         <span className="text-7xl font-semibold tracking-wide">
//           TOUCH TO START
//         </span>
//       </div>
//     </main>
//   );
// }

// "use client";
// import Image from "next/image";
// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const images = [
//   "/images/click_collect.svg",
//   "/images/edisons/edisons-logo Black.svg",
//   "/images/mytopia/mytopia-logo-black.svg",
// ];

// export default function Home() {
//   const router = useRouter();
//   const [current, setCurrent] = useState(0);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setCurrent((prev) => (prev + 1) % images.length);
//     }, 4000); // change slide every 4 seconds
//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <main className="flex flex-col items-center justify-between w-full h-screen bg-white">
//       {/* Logo Section */}
//       <header className="pt-10">
//         <Image
//           src="/images/Mills Brand/Mills Brand_logo (registered)-01.png"
//           alt="Mills Brands logo"
//           width={550}
//           height={200}
//           priority
//           className="mx-auto h-auto w-auto"
//         />
//       </header>

//       {/* Center Slideshow */}
//       <section className="relative flex items-center justify-center flex-1 w-full overflow-hidden">
//         {images.map((src, index) => (
//           <Image
//             key={index}
//             src={src}
//             alt={`Slide ${index + 1}`}
//             width={800}
//             height={600}
//             className={`absolute transition-opacity duration-1000 ease-in-out ${
//               index === current ? "opacity-100" : "opacity-0"
//             } h-auto w-auto max-w-[90vw]`}
//           />
//         ))}
//       </section>

//       {/* Touch to Start Button */}
//       <footer
//         className="flex items-center justify-center w-full gap-6 py-8 text-white bg-gradient-to-r from-[#0070C9] to-[#004E9A] cursor-pointer transition active:opacity-80"
//         role="button"
//         tabIndex={0}
//         aria-label="Touch to start"
//         onClick={() => router.push("/choose-service")}
//       >
//         <Image
//           src="/images/hand.png"
//           alt="Touch icon"
//           width={100}
//           height={100}
//           className="object-contain"
//         />
//         <span className="text-5xl font-semibold tracking-wide">
//           TOUCH TO START
//         </span>
//       </footer>
//     </main>
//   );
// }

"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import FloatingKioskCall from "@/app/components/FlotingKioskCall";

const images = [
  "/images/click_collect.svg",
  "/images/edisons/edisons-logo Black.svg",
  "/images/mytopia/mytopia-logo-black.svg",
];

export default function Home() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex flex-col items-center justify-between min-h-screen w-full bg-white">
      {/* Logo Section */}
      <header className="pt-6 md:pt-10">
        <Image
          src="/images/Mills Brand/Mills Brand_logo (registered)-01.png"
          alt="Mills Brands logo"
          width={650}
          height={300}
          priority
          className="mx-auto h-auto w-[300px] sm:w-[400px] md:w-[500px] lg:w-[600px]"
        />
      </header>

      {/* Slideshow */}
      <section className="relative flex items-center justify-center flex-1 w-full overflow-hidden px-4">
        {images.map((src, index) => (
          <Image
            key={index}
            src={src}
            alt={`Slide ${index + 1}`}
            width={1000}
            height={900}
            className={`absolute transition-opacity duration-1000 ease-in-out ${index === current ? "opacity-100" : "opacity-0"
              } h-auto w-[100vw] sm:w-[90vw] md:w-[80vw] lg:w-[70vw] xl:w-[60vw]`}
          />
        ))}
      </section>

      {/* Touch to Start Button */}
      <footer
        className="flex flex-col sm:flex-row items-center justify-center w-full gap-3 sm:gap-6 py-6 sm:py-8 px-4 text-white bg-gradient-to-r from-[#0070C9] to-[#004E9A] cursor-pointer transition active:opacity-80"
        role="button"
        tabIndex={0}
        aria-label="Touch to start"
        onClick={() => window.dispatchEvent(new Event("open-call"))}
      >
        <Image
          src="/images/hand.png"
          alt="Touch icon"
          width={80}
          height={80}
          className="object-contain w-[60px] sm:w-[80px] md:w-[100px]"
        />
        <span className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-semibold tracking-wide text-center">
          TOUCH TO START
        </span>
      </footer>

      {/* 🚀 Add the floating kiosk call */}
      <FloatingKioskCall />
    </main>
  );
}
