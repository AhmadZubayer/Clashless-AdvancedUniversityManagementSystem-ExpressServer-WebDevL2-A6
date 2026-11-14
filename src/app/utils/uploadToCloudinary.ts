import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { cloudinary } from "../lib/cloudinary";
import { AppError } from "./AppError";

export const uploadToCloudinary = (
	buffer: Buffer,
	options: UploadApiOptions = { resource_type: "auto" },
) => {
	return new Promise<UploadApiResponse & { url: string; publicId: string }>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(options, (error, result) => {
					if (error) {
						return reject(error);
					}

					if (!result) {
						return reject(
							new AppError(
								httpStatus.INTERNAL_SERVER_ERROR,
								"No result returned from Cloudinary",
							),
						);
					}

					resolve({
						...result,
						url: result.secure_url,
						publicId: result.public_id,
					});
				})
				.end(buffer);
		},
	);
};

export const deleteFromCloudinary = async (publicId: string) => {
	await cloudinary.uploader.destroy(publicId);
};
