package com.greeneye.backend.util;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Iterator;

/** Gemini 업로드 전 이미지 축소·JPEG 압축 (응답 속도·터널 타임아웃 완화) */
public final class ImagePrepareUtil {

    private ImagePrepareUtil() {
    }

    public record PreparedImage(byte[] bytes, String mimeType, int originalBytes, int preparedBytes) {
    }

    public static PreparedImage prepare(byte[] input, String contentType, int maxSide, float jpegQuality) {
        if (input == null || input.length == 0) {
            throw new IllegalArgumentException("image is empty");
        }
        int originalBytes = input.length;
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(input));
            if (src == null) {
                return new PreparedImage(input, fallbackMime(contentType), originalBytes, originalBytes);
            }

            int w = src.getWidth();
            int h = src.getHeight();
            int longest = Math.max(w, h);
            BufferedImage working = src;
            if (longest > maxSide) {
                float scale = (float) maxSide / longest;
                int nw = Math.max(1, Math.round(w * scale));
                int nh = Math.max(1, Math.round(h * scale));
                working = resize(src, nw, nh);
            }

            byte[] jpeg = toJpeg(working, jpegQuality);
            return new PreparedImage(jpeg, "image/jpeg", originalBytes, jpeg.length);
        } catch (Exception e) {
            return new PreparedImage(input, fallbackMime(contentType), originalBytes, originalBytes);
        }
    }

    private static String fallbackMime(String contentType) {
        if (contentType != null && !contentType.isBlank()) {
            return contentType;
        }
        return "image/jpeg";
    }

    private static BufferedImage resize(BufferedImage src, int width, int height) {
        Image scaled = src.getScaledInstance(width, height, Image.SCALE_SMOOTH);
        BufferedImage out = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.drawImage(scaled, 0, 0, null);
        g.dispose();
        return out;
    }

    private static byte[] toJpeg(BufferedImage image, float quality) throws Exception {
        BufferedImage rgb = image;
        if (image.getType() != BufferedImage.TYPE_INT_RGB) {
            rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            g.drawImage(image, 0, 0, null);
            g.dispose();
        }

        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            ByteArrayOutputStream fallback = new ByteArrayOutputStream();
            ImageIO.write(rgb, "jpeg", fallback);
            return fallback.toByteArray();
        }

        ImageWriter writer = writers.next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        if (param.canWriteCompressed()) {
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(Math.max(0.5f, Math.min(1f, quality)));
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (MemoryCacheImageOutputStream ios = new MemoryCacheImageOutputStream(out)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(rgb, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}
