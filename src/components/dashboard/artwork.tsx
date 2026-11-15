"use client";

import Image from "next/image";
import { useState } from "react";
import { Crown, Layers3 } from "lucide-react";
import type { Card } from "@/lib/dashboard/types";

export function CardArtwork({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="card-art"
      title={`${card.name}${card.elixir !== null && card.elixir >= 0 ? ` · ${card.elixir} elixir` : ""}`}
    >
      {card.image && !failed ? (
        <Image
          src={card.image}
          alt={card.name}
          width={78}
          height={94}
          sizes="(max-width: 600px) 45px, 70px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="card-art-fallback">
          <Layers3 size={16} />
          <span>{card.name}</span>
        </span>
      )}
      {card.elixir !== null && card.elixir >= 0 && (
        <span className="elixir-pip">{card.elixir}</span>
      )}
      {card.evolution === 1 && (
        <span className="evolution-mark" aria-label="Evolved">
          ◆
        </span>
      )}
    </span>
  );
}

export function PlayerAvatar({
  image,
  name,
  large = false,
}: {
  image: string | null;
  name: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`player-avatar ${large ? "large" : ""}`}>
      {image && !failed ? (
        <Image
          src={image}
          alt={`${name} battle badge`}
          width={100}
          height={100}
          sizes="100px"
          onError={() => setFailed(true)}
        />
      ) : (
        <Crown size={30} />
      )}
    </span>
  );
}
