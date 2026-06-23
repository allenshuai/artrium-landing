"use client";

import dynamic from "next/dynamic";
import "mapbox-gl/dist/mapbox-gl.css";
import { Suspense } from "react";

const MapClient = dynamic(() => import("./MapClient"), { ssr: false });

export default function MapPage() {
  return (
    <Suspense>
      <MapClient />
    </Suspense>
  );
}
