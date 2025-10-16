const PDFDocument = require("pdfkit");
const Appointment = require("../Model/AppointmentModel");
const Dentist = require("../Model/DentistModel");
const Feedback = require("../Model/FeedbackModel");
const InventoryItem = require("../Model/Inventory");
const InventoryMovement = require("../Model/InventoryRequest");
const Queue = require("../Model/QueueModel");

// GET /api/manager/reports/overview
const getOverview = async (req, res) => {
	try {
		const [appointmentsCount, dentistsCount, avgRatingAgg, lowStock] = await Promise.all([
			Appointment.countDocuments({}),
			Dentist.countDocuments({}),
			Feedback.aggregate([{ $group: { _id: null, avgRating: { $avg: "$rating" } } }]),
			InventoryItem.find({ $expr: { $lte: ["$quantity", "$lowStockThreshold"] } }).select("name sku quantity lowStockThreshold")
		]);

		const avgRating = avgRatingAgg[0]?.avgRating || null;
		return res.status(200).json({ appointmentsCount, dentistsCount, avgRating, lowStock });
	} catch (err) {
		return res.status(500).json({ message: "Failed to load overview", error: String(err) });
	}
};

// GET /api/manager/reports/dentist-workload
const dentistWorkload = async (req, res) => {
	try {
		// Get all dentists
		const dentists = await Dentist.find({}).populate('userId', 'name').lean();
		
		// Count queue entries per dentist
		const queueCounts = await Queue.aggregate([
			{ $group: { 
				_id: "$dentistCode",
				total: { $sum: 1 },
				completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
				inTreatment: { $sum: { $cond: [{ $eq: ["$status", "in_treatment"] }, 1, 0] } },
				waiting: { $sum: { $cond: [{ $eq: ["$status", "waiting"] }, 1, 0] } }
			}}
		]);
		
		// Map queue counts by dentist code
		const countsMap = {};
		queueCounts.forEach(item => {
			countsMap[item._id] = {
				total: item.total,
				completed: item.completed,
				inTreatment: item.inTreatment,
				waiting: item.waiting
			};
		});
		
		// Build workload array
		const workload = dentists.map(dentist => {
			const dentistCode = dentist.dentistCode;
			const counts = countsMap[dentistCode] || { total: 0, completed: 0, inTreatment: 0, waiting: 0 };
			
			return {
				dentistId: dentist._id,
				dentistCode: dentistCode,
				dentistName: dentist.userId?.name || dentist.name || 'Unknown Dentist',
				specialty: dentist.specialization || 'General',
				totalPatients: counts.total,
				completed: counts.completed,
				inTreatment: counts.inTreatment,
				waiting: counts.waiting
			};
		}).sort((a, b) => b.totalPatients - a.totalPatients);
		
		return res.status(200).json({ workload });
	} catch (err) {
		console.error("dentistWorkload error:", err);
		return res.status(500).json({ message: "Failed to load dentist workload", error: String(err) });
	}
};

// GET /api/manager/reports/inventory-usage
const inventoryUsage = async (req, res) => {
	try {
		const agg = await InventoryMovement.aggregate([
			{ $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, item: "$item" }, used: { $sum: "$delta" } } },
			{ $lookup: { from: "inventoryitems", localField: "_id.item", foreignField: "_id", as: "item" } },
			{ $unwind: "$item" },
			{ $project: { day: "$_id.day", itemName: "$item.name", delta: "$used", _id: 0 } },
			{ $sort: { day: 1, itemName: 1 } }
		]);
		return res.status(200).json({ usage: agg });
	} catch (err) {
		return res.status(500).json({ message: "Failed to load inventory usage", error: String(err) });
	}
};

// GET /api/manager/reports/inventory.csv
const exportInventoryCsv = async (req, res) => {
	try {
		const items = await InventoryItem.find({}).sort({ name: 1 });
		const currentDate = new Date().toLocaleDateString();
		
		// Create comprehensive CSV with headers and metadata
		const csvLines = [];
		
		// Report header
		csvLines.push("MIDIQUE DENTAL CLINIC - INVENTORY REPORT");
		csvLines.push(`Generated on: ${currentDate}`);
		csvLines.push(""); // Empty line
		
		// Column headers
		const header = ["Item Name", "SKU", "Unit", "Current Quantity", "Low Stock Threshold", "Status"];
		csvLines.push(header.map(h => `"${h}"`).join(","));
		
		// Data rows with status calculation
		items.forEach(item => {
			const status = item.quantity <= item.lowStockThreshold ? "LOW STOCK" : "OK";
			const row = [
				`"${item.name}"`,
				`"${item.sku}"`,
				`"${item.unit}"`,
				item.quantity,
				item.lowStockThreshold,
				`"${status}"`
			];
			csvLines.push(row.join(","));
		});
		
		// Summary section
		csvLines.push(""); // Empty line
		csvLines.push("SUMMARY");
		csvLines.push(`"Total Items","${items.length}"`);
		csvLines.push(`"Low Stock Items","${items.filter(i => i.quantity <= i.lowStockThreshold).length}"`);
		csvLines.push(`"Total Inventory Value","${items.reduce((sum, i) => sum + i.quantity, 0)} units"`);
		
		const csv = csvLines.join("\n");
		
		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader("Content-Disposition", `attachment; filename="Midique_Inventory_Report_${new Date().toISOString().split('T')[0]}.csv"`);
		return res.status(200).send(csv);
	} catch (err) {
		console.error("exportInventoryCsv error:", err);
		if (!res.headersSent) {
			return res.status(500).json({ message: "Failed to export CSV", error: String(err) });
		}
	}
};

// GET /api/manager/reports/inventory.pdf
const exportInventoryPdf = async (req, res) => {
	try {
		const items = await InventoryItem.find({}).sort({ name: 1 });
		const currentDate = new Date().toLocaleDateString();
		const currentTime = new Date().toLocaleTimeString();
		
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", `attachment; filename="Midique_Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf"`);
		
		const doc = new PDFDocument({ 
			margin: 50, 
			size: "A4",
			info: {
				Title: 'Midique Dental Clinic - Inventory Report',
				Author: 'Manager Dashboard',
				Subject: 'Inventory Management Report',
				Keywords: 'dental, inventory, management, report'
			}
		});
		
		doc.pipe(res);
		
		// Header with clinic name and logo area
		doc.fontSize(24)
		   .fillColor('#1e40af')
		   .text('MIDIQUE DENTAL CLINIC', { align: 'center' })
		   .moveDown(0.3);
		
		doc.fontSize(18)
		   .fillColor('#374151')
		   .text('INVENTORY MANAGEMENT REPORT', { align: 'center' })
		   .moveDown(0.5);
		
		// Report metadata
		doc.fontSize(12)
		   .fillColor('#6b7280')
		   .text(`Generated on: ${currentDate} at ${currentTime}`, { align: 'center' })
		   .moveDown(1);
		
		// Summary section
		const totalItems = items.length;
		const lowStockItems = items.filter(i => i.quantity <= i.lowStockThreshold).length;
		const totalInventory = items.reduce((sum, i) => sum + i.quantity, 0);
		
		doc.fontSize(14)
		   .fillColor('#1f2937')
		   .text('SUMMARY', { underline: true })
		   .moveDown(0.3);
		
		doc.fontSize(11)
		   .fillColor('#374151')
		   .text(`Total Items: ${totalItems}`)
		   .text(`Low Stock Items: ${lowStockItems}`)
		   .text(`Total Inventory Units: ${totalInventory}`)
		   .moveDown(1);
		
		// Table header
		doc.fontSize(12)
		   .fillColor('#1f2937')
		   .text('INVENTORY DETAILS', { underline: true })
		   .moveDown(0.5);
		
		// Create table
		const tableTop = doc.y;
		const itemHeight = 20;
		const colWidths = [120, 80, 60, 80, 100, 80];
		const colPositions = [50, 170, 250, 310, 390, 470];
		
		// Table header background
		doc.rect(50, tableTop, 500, itemHeight)
		   .fillColor('#f3f4f6')
		   .fill()
		   .stroke();
		
		// Table header text
		doc.fillColor('#1f2937')
		   .fontSize(10)
		   .text('ITEM NAME', colPositions[0], tableTop + 6, { width: colWidths[0] })
		   .text('SKU', colPositions[1], tableTop + 6, { width: colWidths[1] })
		   .text('UNIT', colPositions[2], tableTop + 6, { width: colWidths[2] })
		   .text('QUANTITY', colPositions[3], tableTop + 6, { width: colWidths[3] })
		   .text('LOW STOCK', colPositions[4], tableTop + 6, { width: colWidths[4] })
		   .text('STATUS', colPositions[5], tableTop + 6, { width: colWidths[5] });
		
		// Table rows
		let currentY = tableTop + itemHeight;
		
		items.forEach((item, index) => {
			// Alternate row colors
			if (index % 2 === 0) {
				doc.rect(50, currentY, 500, itemHeight)
				   .fillColor('#ffffff')
				   .fill();
			} else {
				doc.rect(50, currentY, 500, itemHeight)
				   .fillColor('#f9fafb')
				   .fill();
			}
			
			// Row border
			doc.rect(50, currentY, 500, itemHeight)
			   .fillColor('#e5e7eb')
			   .stroke();
			
			// Safe field extraction with defaults
			const itemName = item.name || item.itemName || 'Unknown';
			const itemSku = item.sku || item.itemCode || 'N/A';
			const itemUnit = item.unit || 'unit';
			const itemQty = item.quantity || 0;
			const itemThreshold = item.lowStockThreshold || 10;
			
			// Status color
			const status = itemQty <= itemThreshold ? 'LOW STOCK' : 'OK';
			const statusColor = itemQty <= itemThreshold ? '#dc2626' : '#059669';
			
			// Row data
			doc.fillColor('#374151')
			   .fontSize(9)
			   .text(itemName, colPositions[0], currentY + 6, { width: colWidths[0] })
			   .text(itemSku, colPositions[1], currentY + 6, { width: colWidths[1] })
			   .text(itemUnit, colPositions[2], currentY + 6, { width: colWidths[2] })
			   .text(String(itemQty), colPositions[3], currentY + 6, { width: colWidths[3] })
			   .text(String(itemThreshold), colPositions[4], currentY + 6, { width: colWidths[4] })
			   .fillColor(statusColor)
			   .text(status, colPositions[5], currentY + 6, { width: colWidths[5] });
			
			currentY += itemHeight;
			
			// Check if we need a new page
			if (currentY > 700) {
				doc.addPage();
				currentY = 50;
			}
		});
		
		// Footer
		const footerY = doc.page.height - 50;
		doc.fontSize(8)
		   .fillColor('#6b7280')
		   .text('This report was generated by Midique Dental Clinic Manager Dashboard', 50, footerY, { align: 'center' })
		   .text(`Page ${doc.page.number}`, 50, footerY + 15, { align: 'center' });
		
		doc.end();
	} catch (err) {
		console.error("exportInventoryPdf error:", err);
		if (!res.headersSent) {
			return res.status(500).json({ message: "Failed to export PDF", error: String(err) });
		}
	}
};

// GET /api/manager/reports/stock-requests.csv
const exportStockRequestsCsv = async (req, res) => {
	try {
		const InventoryRequest = require("../Model/InventoryRequest");
		const requests = await InventoryRequest.find({}).sort({ createdAt: -1 }).lean();
		const currentDate = new Date().toLocaleDateString();
		
		const csvLines = [];
		
		// Report header
		csvLines.push("MIDIQUE DENTAL CLINIC - STOCK REQUESTS REPORT");
		csvLines.push(`Generated on: ${currentDate}`);
		csvLines.push("");
		
		// Column headers
		const header = ["Request Code", "Request Date", "Dentist", "Items", "Status", "Notes"];
		csvLines.push(header.map(h => `"${h}"`).join(","));
		
		// Data rows
		requests.forEach(request => {
			const itemsList = request.items && request.items.length > 0 
				? request.items.map(i => `${i.itemName} (${i.quantity})`).join('; ')
				: 'No items';
			
			const row = [
				`"${request.requestCode || 'N/A'}"`,
				`"${new Date(request.createdAt).toLocaleDateString()}"`,
				`"${request.dentistName || 'Unknown'}"`,
				`"${itemsList}"`,
				`"${request.status || 'Pending'}"`,
				`"${request.notes || 'No notes'}"`
			];
			csvLines.push(row.join(","));
		});
		
		// Summary
		csvLines.push("");
		csvLines.push("SUMMARY");
		csvLines.push(`"Total Requests","${requests.length}"`);
		csvLines.push(`"Pending Requests","${requests.filter(r => r.status === 'Pending').length}"`);
		csvLines.push(`"Approved Requests","${requests.filter(r => r.status === 'Approved').length}"`);
		csvLines.push(`"Rejected Requests","${requests.filter(r => r.status === 'Rejected').length}"`);
		
		const csv = csvLines.join("\n");
		
		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader("Content-Disposition", `attachment; filename="Midique_StockRequests_Report_${new Date().toISOString().split('T')[0]}.csv"`);
		return res.status(200).send(csv);
	} catch (err) {
		console.error("exportStockRequestsCsv error:", err);
		if (!res.headersSent) {
			return res.status(500).json({ message: "Failed to export stock requests CSV", error: String(err) });
		}
	}
};

// GET /api/manager/reports/comprehensive.pdf
const exportComprehensivePdf = async (req, res) => {
	try {
		// Fetch all data needed for the comprehensive report
		const [items, appointments, dentists, feedbackAgg, queueData] = await Promise.all([
			InventoryItem.find({}).sort({ name: 1 }).lean(),
			Appointment.find({}).lean(),
			Dentist.find({}).populate('userId', 'name').lean(),
			Feedback.aggregate([{ $group: { _id: null, avgRating: { $avg: "$rating" } } }]),
			Queue.aggregate([
				{ $group: { 
					_id: "$dentistCode",
					total: { $sum: 1 },
					completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
				}}
			])
		]);
		
		// Calculate statistics
		const appointmentsCount = appointments.length;
		const dentistsCount = dentists.length;
		const avgRating = feedbackAgg[0]?.avgRating || 0;
		const lowStockItems = items.filter(item => item.quantity <= (item.lowStockThreshold || 10));
		
		const currentDate = new Date().toLocaleDateString();
		const currentTime = new Date().toLocaleTimeString();
		
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", `attachment; filename="Midique_Comprehensive_Report_${new Date().toISOString().split('T')[0]}.pdf"`);
		
		const doc = new PDFDocument({ 
			margin: 50, 
			size: "A4",
			info: {
				Title: 'Midique Dental Clinic - Comprehensive Report',
				Author: 'Manager Dashboard',
				Subject: 'Complete Management Report',
				Keywords: 'dental, management, comprehensive, report'
			}
		});
		
		doc.pipe(res);
		
		// Title page
		doc.fontSize(28)
		   .fillColor('#1e40af')
		   .text('MIDIQUE DENTAL CLINIC', { align: 'center' })
		   .moveDown(0.5);
		
		doc.fontSize(20)
		   .fillColor('#374151')
		   .text('COMPREHENSIVE MANAGEMENT REPORT', { align: 'center' })
		   .moveDown(1);
		
		doc.fontSize(14)
		   .fillColor('#6b7280')
		   .text(`Generated on: ${currentDate} at ${currentTime}`, { align: 'center' })
		   .moveDown(2);
		
		// Table of Contents
		doc.fontSize(16)
		   .fillColor('#1f2937')
		   .text('TABLE OF CONTENTS', { underline: true })
		   .moveDown(0.5);
		
		doc.fontSize(12)
		   .fillColor('#374151')
		   .text('1. Executive Summary')
		   .text('2. Inventory Management')
		   .text('3. Dentist Workload Analysis')
		   .text('4. Low Stock Alerts')
		   .moveDown(1);
		
		// Page 2: Executive Summary
		doc.addPage();
		doc.fontSize(18)
		   .fillColor('#1f2937')
		   .text('EXECUTIVE SUMMARY', { underline: true })
		   .moveDown(0.5);
		
		doc.fontSize(12)
		   .fillColor('#374151')
		   .text(`Total Appointments: ${appointmentsCount}`)
		   .text(`Total Dentists: ${dentistsCount}`)
		   .text(`Average Rating: ${avgRating.toFixed(2)} / 5.0`)
		   .text(`Low Stock Items: ${lowStockItems.length}`)
		   .moveDown(1);
		
		// Dentist Workload Section (from Queue data)
		doc.fontSize(16)
		   .fillColor('#1f2937')
		   .text('DENTIST WORKLOAD (Patient Queue History)', { underline: true })
		   .moveDown(0.5);
		
		// Map queue data by dentist code
		const queueMap = {};
		queueData.forEach(q => {
			queueMap[q._id] = { total: q.total, completed: q.completed };
		});
		
		dentists.forEach((dentist, index) => {
			const dentistCode = dentist.dentistCode;
			const queueStats = queueMap[dentistCode] || { total: 0, completed: 0 };
			const dentistName = dentist.userId?.name || dentist.name || `Dentist ${index + 1}`;
			
			doc.fontSize(12)
			   .fillColor('#374151')
			   .text(`${dentistName} (${dentistCode || 'N/A'}): ${queueStats.total} patients (${queueStats.completed} completed)`)
			   .moveDown(0.3);
		});
		
		doc.moveDown(1);
		
		// Inventory Section
		doc.fontSize(16)
		   .fillColor('#1f2937')
		   .text('INVENTORY MANAGEMENT', { underline: true })
		   .moveDown(0.5);
		
		doc.fontSize(12)
		   .fillColor('#374151')
		   .text(`Total Inventory Items: ${items.length}`)
		   .text(`Low Stock Items: ${lowStockItems.length}`)
		   .moveDown(1);
		
		// Page 3: Inventory Details
		doc.addPage();
		doc.fontSize(18)
		   .fillColor('#1f2937')
		   .text('INVENTORY MANAGEMENT', { underline: true })
		   .moveDown(0.5);
		
		// Inventory table
		const tableTop = doc.y;
		const itemHeight = 20;
		const colWidths = [120, 80, 60, 80, 100, 80];
		const colPositions = [50, 170, 250, 310, 390, 470];
		
		// Table header
		doc.rect(50, tableTop, 500, itemHeight)
		   .fillColor('#f3f4f6')
		   .fill()
		   .stroke();
		
		doc.fillColor('#1f2937')
		   .fontSize(10)
		   .text('ITEM NAME', colPositions[0], tableTop + 6, { width: colWidths[0] })
		   .text('SKU', colPositions[1], tableTop + 6, { width: colWidths[1] })
		   .text('UNIT', colPositions[2], tableTop + 6, { width: colWidths[2] })
		   .text('QUANTITY', colPositions[3], tableTop + 6, { width: colWidths[3] })
		   .text('LOW STOCK', colPositions[4], tableTop + 6, { width: colWidths[4] })
		   .text('STATUS', colPositions[5], tableTop + 6, { width: colWidths[5] });
		
		let currentY = tableTop + itemHeight;
		
		items.forEach((item, index) => {
			if (index % 2 === 0) {
				doc.rect(50, currentY, 500, itemHeight)
				   .fillColor('#ffffff')
				   .fill();
			} else {
				doc.rect(50, currentY, 500, itemHeight)
				   .fillColor('#f9fafb')
				   .fill();
			}
			
			doc.rect(50, currentY, 500, itemHeight)
			   .fillColor('#e5e7eb')
			   .stroke();
			
			const status = item.quantity <= item.lowStockThreshold ? 'LOW STOCK' : 'OK';
			const statusColor = item.quantity <= item.lowStockThreshold ? '#dc2626' : '#059669';
			
			doc.fillColor('#374151')
			   .fontSize(9)
			   .text(item.name, colPositions[0], currentY + 6, { width: colWidths[0] })
			   .text(item.sku, colPositions[1], currentY + 6, { width: colWidths[1] })
			   .text(item.unit, colPositions[2], currentY + 6, { width: colWidths[2] })
			   .text(item.quantity.toString(), colPositions[3], currentY + 6, { width: colWidths[3] })
			   .text(item.lowStockThreshold.toString(), colPositions[4], currentY + 6, { width: colWidths[4] })
			   .fillColor(statusColor)
			   .text(status, colPositions[5], currentY + 6, { width: colWidths[5] });
			
			currentY += itemHeight;
			
			if (currentY > 700) {
				doc.addPage();
				currentY = 50;
			}
		});
		
		// Footer on each page
		const footerY = doc.page.height - 50;
		doc.fontSize(8)
		   .fillColor('#6b7280')
		   .text('Midique Dental Clinic - Comprehensive Management Report', 50, footerY, { align: 'center' })
		   .text(`Page ${doc.page.number}`, 50, footerY + 15, { align: 'center' });
		
		doc.end();
	} catch (err) {
		console.error("exportComprehensivePdf error:", err);
		if (!res.headersSent) {
			return res.status(500).json({ message: "Failed to export comprehensive PDF", error: String(err) });
		}
	}
};

module.exports = { 
	getOverview, 
	dentistWorkload, 
	inventoryUsage, 
	exportInventoryCsv, 
	exportInventoryPdf,
	exportStockRequestsCsv,
	exportComprehensivePdf
};


