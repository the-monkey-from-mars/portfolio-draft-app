"use client";
import { useState } from "react";
import Link from "next/link";
import RulesModal from "./RulesModal";
import WaiverRulesModal from "./WaiverRulesModal";

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="bg-gray-800 hover:bg-gray-700 text-white p-2.5 rounded transition border border-gray-700"
        aria-label="Open menu"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>

      {/* Slide-out panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-72 bg-gray-900 border-l border-gray-700 z-50 shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-700">
              <span className="text-white font-bold text-lg">Menu</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex flex-col p-4 space-y-3">
              <Link
                href="/office"
                onClick={() => setIsOpen(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition text-center"
              >
                Manager Office
              </Link>

              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded transition text-center border border-gray-600"
              >
                Admin Draft Room
              </Link>

              <div className="pt-3 border-t border-gray-700 space-y-3">
                {/*
                  FIX: Previously wrapping these in <div onClick={() => setIsOpen(false)}>
                  caused the hamburger panel to close BEFORE the modal could open.
                  The parent div's click handler fired first, unmounting the panel
                  (and its children) before the modal button's onClick could execute.

                  Now: no auto-close wrapper. The modal opens on top of everything
                  (z-50 for panel, z-50 for modal backdrop). When the user closes
                  the modal, they're back in the hamburger panel.
                */}
                <div>
                  <RulesModal />
                </div>
                <div>
                  <WaiverRulesModal />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
