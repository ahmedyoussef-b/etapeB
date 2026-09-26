export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { safeGetAllMedia, safeCreateMedia, safeGetCategories } from "@/lib/services/images.fallback";
import { withAuth } from "@/lib/api/auth-guard";
import { getPrismaClient } from "@/lib/services/db";
import { storeFile } from "@/lib/storage";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const GET = withAuth(async () => {
  try {
    const [items, categories] = await Promise.all([safeGetAllMedia(), safeGetCategories()]);
    return NextResponse.json({ items, categories });
  } catch (error) {
    console.error("Failed to fetch images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}, 'banque-images:view');

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
      }

      const fileName = file.name;
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const allowedExts = ["jpg", "jpeg", "png", "gif", "svg", "webp"];

      if (!allowedExts.includes(ext)) {
        return NextResponse.json(
          { error: "Format non supporté. Utilisez: jpg, jpeg, png, gif, svg, webp" },
          { status: 400 }
        );
      }

      const baseName = fileName.replace(/\.[^.]+$/, "");
      let slug = slugify(baseName);

      if (!slug) {
        return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 });
      }

      const prisma = getPrismaClient();

      let finalSlug = slug;
      let counter = 1;
      while (
        await prisma.document.findFirst({
          where: { path: { startsWith: `bank/${finalSlug}/` } },
        })
      ) {
        finalSlug = `${slug}_${counter}`;
        counter += 1;
      }

      const folderPath = `bank/${finalSlug}`;
      const imagePath = `${folderPath}/${finalSlug}.${ext}`;
      const jsonPath = `${folderPath}/${finalSlug}.json`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const metadata = {
        name: finalSlug,
        display_name: baseName,
        description: "",
        tags: [finalSlug.replace(/_/g, " ")],
        category: "Non classé",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          source: "upload",
          author: (request as any).user?.email || "unknown",
          original_filename: fileName,
          size: buffer.length,
          mime: file.type,
        },
      };

      const metadataJson = Buffer.from(JSON.stringify(metadata, null, 2));

      storeFile(imagePath, buffer, file.type);
      storeFile(jsonPath, metadataJson, "application/json");

      await prisma.document.createMany({
        data: [
          {
            filename: `${finalSlug}.${ext}`,
            path: imagePath,
            mimeType: file.type,
            size: buffer.length,
            data: buffer,
            metadata: { ...metadata, kind: "image" } as any,
            createdAt: new Date(),
            updatedAt: new Date(),
            injectedAt: null,
          },
          {
            filename: `${finalSlug}.json`,
            path: jsonPath,
            mimeType: "application/json",
            size: metadataJson.length,
            data: metadataJson,
            metadata: metadata as any,
            createdAt: new Date(),
            updatedAt: new Date(),
            injectedAt: null,
          },
        ],
      });

      const imageDoc = await prisma.document.findFirst({
        where: { path: imagePath },
        select: { id: true, filename: true, path: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
      });

      let dataUrl = "";
      if (imageDoc?.data) {
        const buf = Buffer.isBuffer(imageDoc.data) ? imageDoc.data : Buffer.from(imageDoc.data);
        if (buf.length > 0) {
          dataUrl = `data:${imageDoc.mimeType || "image/jpeg"};base64,${buf.toString("base64")}`;
        }
      }

      const createdItem = {
        id: imageDoc?.id || finalSlug,
        title: (imageDoc?.metadata as any)?.display_name || baseName,
        category: (imageDoc?.metadata as any)?.category || "Non classé",
        description: (imageDoc?.metadata as any)?.description || "",
        tags: (imageDoc?.metadata as any)?.tags || [finalSlug.replace(/_/g, " ")],
        kind: "image" as const,
        mimeType: imageDoc?.mimeType || file.type,
        size: imageDoc?.size || buffer.length,
        dataUrl,
        createdAt: imageDoc?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: imageDoc?.updatedAt?.toISOString() || new Date().toISOString(),
      };

      return NextResponse.json(
        {
          success: true,
          slug: finalSlug,
          folderPath,
          imagePath,
          jsonPath,
          metadata,
          item: createdItem,
        },
        { status: 201 }
      );
    }

    const body = await request.json();
    const item = await safeCreateMedia(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Invalid data:", error);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}, 'banque-images:upload');