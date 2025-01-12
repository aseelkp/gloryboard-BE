import { PDFDocument, rgb, StandardFonts, layoutSinglelineText } from "pdf-lib";
import fs from "fs";
import { zone } from "../constants.js";
import { getZoneConfig } from "../utils/zoneConfig.js";

export const generateParticipantTickets = async (users) => {
  try {
    const copies = [`${zone.toLocaleUpperCase()}-Zone Copy`, "Student Copy"];
    const { primaryColor, ticketHeaderImagePath, footerText } = getZoneConfig(zone);
    if (!primaryColor || !ticketHeaderImagePath) {
      throw new Error("Zone configuration not found");
    }

    const pdfDoc = await PDFDocument.create();

    // Embed the standard fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Define common measurements and styles
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 25;

    const headerImageFile = fs.readFileSync(ticketHeaderImagePath);
    const headerImage = await pdfDoc.embedPng(headerImageFile);
    const { width: headerImageWidth, height: headerImageHeight } =
      headerImage.scaleToFit(pageWidth - 2 * margin, 165);

    const ticketY = pageHeight - margin - headerImageHeight - 12;

    for (const user of users) {
      let image;
      if (user.image) {
        if (user.image.endsWith(".png")) {
          const pngImageBytes = await fetch(user.image).then((res) =>
            res.arrayBuffer()
          );
          image = await pdfDoc.embedPng(pngImageBytes);
        } else if (
          user.image.endsWith(".jpg") ||
          user.image.endsWith(".jpeg")
        ) {
          const jpgImageBytes = await fetch(user.image).then((res) =>
            res.arrayBuffer()
          );
          image = await pdfDoc.embedJpg(jpgImageBytes);
        } else {
          throw new Error("Unsupported image format");
        }
      } else {
        image = null;
      }

      for (const copy of copies) {
        let nextPage = false;
        const offStagePrograms = [...user.programs.offStage];
        const stagePrograms = [...user.programs.stage];
        const groupPrograms = [...user.programs.group];
        do {
          nextPage = false;
          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          // Header Image
          page.drawImage(headerImage, {
            x: pageWidth / 2 - headerImageWidth / 2,
            y: pageHeight - margin + 10 - headerImageHeight,
            width: headerImageWidth,
            height: headerImageHeight,
          });

          // Header text
          page.drawText(`( ${copy} )`, {
            x: pageWidth / 2 - 50,
            y: pageHeight - margin - headerImageHeight - 3,
            size: 12,
          });

          // Draw main ticket container
          page.drawRectangle({
            x: margin,
            y: ticketY - 455,
            width: pageWidth - 2 * margin,
            height: 455,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
          });

          // Personal Details Section
          const detailsStartX = margin + 135.2; // After photo space
          const detailsStartY = ticketY - 10;

          // Draw photo
          if (image) {
            page.drawImage(image, {
              x: margin + 10,
              y: ticketY - 154,
              width: 115.2,
              height: 144,
            });
          }

          // Draw personal details
          const fieldHeight = 24;
          const drawField = (
            label,
            value,
            x,
            y,
            width,
            containerHeight = fieldHeight
          ) => {
            const labelWidth = helveticaBold.widthOfTextAtSize(label, 14);

            page.drawRectangle({
              x,
              y: y - containerHeight,
              width,
              height: containerHeight,
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });

            page.drawText(label, {
              x: x + 5,
              y: y - 17,
              font: helveticaBold,
              size: 14,
            });

            page.drawText(value || "", {
              x: x + 10 + labelWidth,
              y: y - 17,
              font: helvetica,
              size: 14,
              maxWidth: width - labelWidth - 15,
              lineHeight: 20,
            });
          };

          const drawDynamicSizeField = (
            label,
            value,
            x,
            y,
            width,
            containerHeight = fieldHeight
          ) => {
            const labelWidth = helveticaBold.widthOfTextAtSize(label, 14);
            const valueWidth = helvetica.widthOfTextAtSize(value, 14);
            let valueFontSize = 14;
            const availableWidth = width - labelWidth - 15;

            if (valueWidth > availableWidth) {
              const { fontSize } = layoutSinglelineText(value, {
                font: helvetica,
                bounds: {
                  width: availableWidth,
                },
              });
              valueFontSize = fontSize;
            }

            page.drawRectangle({
              x,
              y: y - containerHeight,
              width,
              height: containerHeight,
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });

            page.drawText(label, {
              x: x + 5,
              y: y - 17,
              font: helveticaBold,
              size: 14,
            });

            page.drawText(value || "", {
              x: x + 10 + labelWidth,
              y: y - 17,
              font: helvetica,
              size: valueFontSize,
              maxWidth: availableWidth,
              lineHeight: 20,
            });
          };

          // Draw all personal details fields
          const detailsWidth = pageWidth - detailsStartX - margin - 10;
          drawDynamicSizeField(
            "Name:",
            user.name,
            detailsStartX,
            detailsStartY,
            detailsWidth
          );
          drawField(
            "Reg ID:",
            user.regId,
            detailsStartX,
            detailsStartY - fieldHeight,
            detailsWidth / 2
          );
          drawField(
            "Sex:",
            user.sex,
            detailsStartX + detailsWidth / 2,
            detailsStartY - fieldHeight,
            detailsWidth / 2
          );
          drawField(
            "College:",
            user.college,
            detailsStartX,
            detailsStartY - 2 * fieldHeight,
            detailsWidth,
            2 * fieldHeight
          );
          drawDynamicSizeField(
            "Course:",
            user.course,
            detailsStartX,
            detailsStartY - 4 * fieldHeight,
            detailsWidth
          );
          drawField(
            "Semester:",
            user.semester,
            detailsStartX,
            detailsStartY - 5 * fieldHeight,
            detailsWidth / 2
          );
          drawField(
            "Date of Birth:",
            user.dateOfBirth,
            detailsStartX + detailsWidth / 2,
            detailsStartY - 5 * fieldHeight,
            detailsWidth / 2
          );

          // Programs Section
          const programsY = ticketY - 190;
          const programWidth = (pageWidth - 2 * margin - 20) / 3;

          // Function to draw program section
          const drawProgramSection = (title, programs, x, y) => {
            // Header
            page.drawRectangle({
              x,
              y,
              width: programWidth,
              height: 25,
              color: primaryColor,
            });

            const titleWidth = helveticaBold.widthOfTextAtSize(title, 12);
            page.drawText(title, {
              x: x + programWidth / 2 - titleWidth / 2,
              y: y + 8,
              font: helveticaBold,
              size: 12,
              color: rgb(1, 1, 1),
            });

            // Content area
            page.drawRectangle({
              x,
              y: y - 260,
              width: programWidth,
              height: 285,
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });

            // Draw programs
            let totalLines = 0;
            let pageBreakTriggered = false;
            page.moveTo(x, y - 15);

            programs.forEach((program, index) => {
              if (pageBreakTriggered) return;

              const programText = `• ${program}`;
              const words = programText.split(" ");
              const fontSize = 10;
              const availableWidth = programWidth - 10;
              let currentLine = "";
              let lineCount = 1;

              // Simulate text wrapping to count lines
              words.forEach((word) => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const testWidth = helvetica.widthOfTextAtSize(
                  testLine,
                  fontSize
                );
                if (testWidth > availableWidth) {
                  currentLine = word;
                  lineCount++;
                } else {
                  currentLine = testLine;
                }
              });

              totalLines += lineCount;

              if (totalLines > 15) {
                nextPage = true;
                pageBreakTriggered = true;
                programs.splice(0, index);
                return;
              } else if (index === programs.length - 1) {
                programs.splice(0, index + 1);
              }

              page.drawText(programText, {
                x: x + 5,
                font: helvetica,
                size: fontSize,
                lineHeight: 14.5,
                maxWidth: availableWidth,
              });
              page.moveDown(lineCount * 14.5 + 2);
            });
          };

          // Draw all program sections
          drawProgramSection(
            "Off Stage",
            offStagePrograms,
            margin + 5,
            programsY
          );
          drawProgramSection(
            "Stage",
            stagePrograms,
            margin + programWidth + 10,
            programsY
          );
          drawProgramSection(
            "Group",
            groupPrograms,
            margin + 2 * programWidth + 15,
            programsY
          );

          // Signature section
          const signatureY = ticketY - 540;
          page.drawText("Principal Signature & Seal", {
            x: margin + 5,
            y: signatureY,
            font: helvetica,
            size: 12,
          });

          if (copy === "Student Copy") {
            page.drawText("University Union Councillor (UUC)", {
              x: pageWidth / 2 - 90,
              y: signatureY,
              font: helvetica,
              size: 12,
            });

            page.drawText(`${zone.toLocaleUpperCase()}-Zone General Convenor`, {
              x: pageWidth - margin - 145,
              y: signatureY,
              font: helvetica,
              size: 12,
            });
            page.drawText(`(For ${zone.toLocaleUpperCase()}-zone office use)`, {
              x: pageWidth - margin - 125,
              y: signatureY - 13,
              font: helvetica,
              size: 10,
            });
          } else {
            page.drawText("University Union Councillor (UUC)", {
              x: pageWidth - margin - 186,
              y: signatureY,
              font: helvetica,
              size: 12,
            });
          }

		  if (footerText) {
				// Footer notes
				const footerY = margin + 45;
				page.drawText("Notes:", {
					x: margin,
					y: footerY,
					font: helveticaBold,
					size: 12,
				});
				page.moveTo(margin, footerY - 15);

				footerText.forEach((note) => {
					page.drawText(`• ${note}`, {
						x: margin,
						font: helvetica,
						size: 10,
					});
					page.moveDown(15);
				});
		  }
        } while (nextPage);
        // }
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    throw error;
  }
};

export const generateProgramParticipantsList = async (programName, participants) => {
  try {
    const { generalHeaderImagePath } = getZoneConfig(zone);
    if (!generalHeaderImagePath) {
      throw new Error("Zone configuration not found");
    }

    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Define measurements
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 25;
    const tableStartY = pageHeight - 180;
    const rowHeight = 25;
    const maxRowsPerPage = Math.floor((tableStartY - margin - 50) / rowHeight);

    // Embed header image
    const headerImageFile = fs.readFileSync(generalHeaderImagePath);
    const headerImage = await pdfDoc.embedPng(headerImageFile);
    const { width: headerImageWidth, height: headerImageHeight } = 
      headerImage.scaleToFit(pageWidth - 2 * margin, 100);

    // Define column widths (Total: 545)
    const columnWidths = {
      slNo: 35,
      chestNo: 70,
      name: 260,
      regId: 80,
      participation: 100
    };

    // Helper function to create a new page
    const createPage = (pageNumber, totalPages) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // Draw header image
      page.drawImage(headerImage, {
        x: pageWidth / 2 - headerImageWidth / 2,
        y: pageHeight - margin - headerImageHeight,
        width: headerImageWidth,
        height: headerImageHeight,
      });

      // Draw program name
      page.drawText(programName, {
        x: pageWidth / 2 - helveticaBold.widthOfTextAtSize(programName, 14) / 2,
        y: pageHeight - margin - headerImageHeight - 25,
        font: helveticaBold,
        size: 14
      });

      // Draw page number
      page.drawText(`Page ${pageNumber} of ${totalPages}`, {
        x: pageWidth - margin - 45,
        y: margin,
        font: helvetica,
        size: 8,
				color: rgb(0.5, 0.5, 0.5)
      });

      return page;
    };

    // Helper function to draw table headers
    const drawTableHeaders = (page, y) => {
      let x = margin;
      const headers = [
        { text: "Sl.No", width: columnWidths.slNo },
        { text: "Chest No", width: columnWidths.chestNo },
        { text: "Name", width: columnWidths.name },
        { text: "Reg ID", width: columnWidths.regId },
        { text: "Participation", width: columnWidths.participation }
      ];

      // Draw header background
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: pageWidth - 2 * margin,
        height: rowHeight,
        color: rgb(0.9, 0.9, 0.9)
      });

      // Draw header texts
      headers.forEach(header => {
				page.drawRectangle({
					x,
					y: y - rowHeight,
					width: header.width,
					height: rowHeight,
					borderColor: rgb(0, 0, 0),
					borderWidth: 1
				})

        page.drawText(header.text, {
          x: x + 5,
          y: y - rowHeight + 8,
          font: helveticaBold,
          size: 10
        });
        
        x += header.width;
      });
    };

    // Calculate total pages needed
    const totalPages = Math.ceil(participants.length / maxRowsPerPage);

    // Generate pages
    let currentPage = 1;
    for (let i = 0; i < participants.length; i += maxRowsPerPage) {
      const page = createPage(currentPage, totalPages);
      const pageParticipants = participants.slice(i, i + maxRowsPerPage);
      let y = tableStartY;

      // Draw table headers
      drawTableHeaders(page, y);
      y -= rowHeight;

      // Draw participant rows
      pageParticipants.forEach((participant, index) => {
        let x = margin;
        const rowData = [
          { text: (i + index + 1).toString(), width: columnWidths.slNo },
          { text: "", width: columnWidths.chestNo }, // Empty chest number column
          { text: participant.name, width: columnWidths.name },
          { text: participant.regId, width: columnWidths.regId },
          { text: "", width: columnWidths.participation } // Empty participation column
        ];

        // Draw row background (alternate colors)
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: pageWidth - 2 * margin,
          height: rowHeight,
          color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.95, 0.95, 0.95)
        });

        // Draw row data
        rowData.forEach(data => {
					// Draw cell border
					page.drawRectangle({
						x,
						y: y - rowHeight,
						width: data.width,
						height: rowHeight,
						borderColor: rgb(0, 0, 0),
						borderWidth: 1
					})

          // Draw cell text
          page.drawText(data.text, {
            x: x + 5,
            y: y - rowHeight + 8,
            font: helvetica,
            size: 10,
            maxWidth: data.width - 10
          });

          x += data.width;
        });

        y -= rowHeight;
      });

      currentPage++;
    }

    return await pdfDoc.save();
  } catch (error) {
    throw error;
  }
};
