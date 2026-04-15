/**
 * Module augmentation for Auth.js. Adds our pseudo_id / display_name
 * fields to the session + JWT shape.
 */

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      pseudo_id: string;
      display_name: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    pseudo_id?: string;
    display_name?: string | null;
  }
}
