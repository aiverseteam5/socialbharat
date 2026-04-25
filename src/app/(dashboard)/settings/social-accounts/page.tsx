"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, CheckCircle, XCircle } from "lucide-react";
import { logger } from "@/lib/logger";
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebook,
  FaLinkedin,
  FaYoutube,
  FaXTwitter,
} from "react-icons/fa6";

interface SocialProfile {
  id: string;
  platform: string;
  platform_username: string;
  is_healthy: boolean;
}

export default function SocialAccountsPage() {
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch("/api/connectors/profiles");
      const data = await response.json();
      setProfiles(data.profiles || []);
    } catch (error) {
      logger.error("Fetch social profiles failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (platform: string) => {
    window.location.href = `/api/connectors/${platform}/auth`;
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;

    try {
      await fetch(`/api/connectors/profiles/${id}`, { method: "DELETE" });
      setProfiles(profiles.filter((p) => p.id !== id));
    } catch (error) {
      logger.error("Disconnect social profile failed", error, {
        profileId: id,
      });
    }
  };

  const platforms = [
    {
      id: "facebook",
      name: "Facebook",
      Icon: FaFacebook,
      color: "#1877F2",
      bg: "bg-blue-50",
    },
    {
      id: "instagram",
      name: "Instagram",
      Icon: FaInstagram,
      color: "#E1306C",
      bg: "bg-pink-50",
    },
    {
      id: "twitter",
      name: "Twitter/X",
      Icon: FaXTwitter,
      color: "#000000",
      bg: "bg-slate-100",
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      Icon: FaLinkedin,
      color: "#0A66C2",
      bg: "bg-blue-50",
    },
    {
      id: "youtube",
      name: "YouTube",
      Icon: FaYoutube,
      color: "#FF0000",
      bg: "bg-red-50",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      Icon: FaWhatsapp,
      color: "#25D366",
      bg: "bg-emerald-50",
    },
  ];

  if (loading) {
    return <div className="text-center py-8">Loading social accounts...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Social Accounts</h1>
      <p className="text-muted-foreground">
        Connect and manage your social media accounts.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => {
          const connectedProfile = profiles.find(
            (p) => p.platform === platform.id,
          );

          return (
            <Card key={platform.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 ${platform.bg} rounded-lg flex items-center justify-center`}
                >
                  <platform.Icon size={22} color={platform.color} aria-hidden />
                </div>
                {connectedProfile ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <h3 className="font-semibold mb-1">{platform.name}</h3>

              {connectedProfile ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {connectedProfile.platform_username}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${connectedProfile.is_healthy ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                    >
                      {connectedProfile.is_healthy ? "Connected" : "Error"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => handleDisconnect(connectedProfile.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleConnect(platform.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">WhatsApp Setup</h3>
        <p className="text-sm text-blue-800 mb-4">
          WhatsApp requires manual setup with your phone number ID and access
          token.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/whatsapp">Setup WhatsApp</Link>
        </Button>
      </Card>
    </div>
  );
}
