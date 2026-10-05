/**
 * iLovePDF Clone - JPG to PDF Converter
 * Full client-side PDF conversion with drag & drop, sorting, rotation, and custom layouts.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    files: [], // Array of { id, file, name, size, dataUrl, width, height, rotation }
    options: {
      orientation: 'portrait', // 'portrait' | 'landscape'
      pageSize: 'A4',          // 'fit' | 'A4' | 'letter'
      margin: 0,               // 0 (none) | 10 (small) | 25 (big)
      mergeAfter: true         // merge all into single PDF
    },
    convertedPdfBlob: null,
    convertedPdfUrl: null,
    outputFilename: 'ilovepdf_converted.pdf'
  };

  // DOM Elements
  const landingView = document.getElementById('landingView');
  const workspaceView = document.getElementById('workspaceView');
  const downloadView = document.getElementById('downloadView');
  const processingOverlay = document.getElementById('processingOverlay');
  const dragOverlay = document.getElementById('dragOverlay');

  const fileInput = document.getElementById('fileInput');
  const btnSelectFiles = document.getElementById('btnSelectFiles');
  const btnAddMore = document.getElementById('btnAddMore');
  const addCardPlaceholder = document.getElementById('addCardPlaceholder');
  const thumbnailsGrid = document.getElementById('thumbnailsGrid');
  const fileCountBadge = document.getElementById('fileCountBadge');

  const btnOrderByName = document.getElementById('btnOrderByName');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnConvert = document.getElementById('btnConvert');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressSubtitle = document.getElementById('progressSubtitle');

  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const btnStartOver = document.getElementById('btnStartOver');
  const downloadFileName = document.getElementById('downloadFileName');
  const downloadFileMeta = document.getElementById('downloadFileMeta');

  const orientationItems = document.querySelectorAll('.visual-option-card[data-option="orientation"]');
  const marginItems = document.querySelectorAll('.visual-option-card[data-option="margin"]');
  const selectPageSize = document.getElementById('selectPageSize');
  const chkMergeAfter = document.getElementById('chkMergeAfter');
  const toast = document.getElementById('toast');

  let sortAscending = true;
  let sortableInstance = null;

  // Initialize SortableJS for drag-and-drop reordering
  function initSortable() {
    if (window.Sortable && thumbnailsGrid) {
      if (sortableInstance) sortableInstance.destroy();
      sortableInstance = new Sortable(thumbnailsGrid, {
        animation: 180,
        handle: '.thumb-card',
        filter: '.add-card-placeholder',
        onEnd: (evt) => {
          if (evt.oldIndex !== evt.newIndex) {
            // Reorder the state.files array according to DOM
            const newOrderIds = Array.from(thumbnailsGrid.querySelectorAll('.thumb-card'))
              .map(card => card.dataset.id);
            state.files.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
            updatePageNumbers();
          }
        }
      });
    }
  }

  // Toast Helper
  function showToast(msg, duration = 3000) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  // Format File Size
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Handle incoming Files
  async function handleFiles(fileList) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const addedFiles = Array.from(fileList).filter(file => {
      const isImg = validTypes.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i);
      return isImg;
    });

    if (addedFiles.length === 0) {
      showToast('Please select valid image files (JPG, PNG, WebP).');
      return;
    }

    // Process files into image previews
    for (const file of addedFiles) {
      try {
        const fileData = await readFileAsync(file);
        state.files.push(fileData);
      } catch (err) {
        console.error('Failed reading file:', file.name, err);
      }
    }

    renderWorkspace();
  }

  function readFileAsync(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            id: 'img_' + Math.random().toString(36).substr(2, 9),
            file: file,
            name: file.name,
            size: file.size,
            dataUrl: e.target.result,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            rotation: 0
          });
        };
        img.onerror = () => reject(new Error('Invalid image'));
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Render Thumbnails and switch view
  function renderWorkspace() {
    if (state.files.length === 0) {
      landingView.style.display = 'flex';
      workspaceView.classList.remove('active');
      downloadView.classList.remove('active');
      return;
    }

    landingView.style.display = 'none';
    downloadView.classList.remove('active');
    workspaceView.classList.add('active');

    fileCountBadge.textContent = `${state.files.length} file${state.files.length > 1 ? 's' : ''}`;

    // Render cards
    thumbnailsGrid.innerHTML = '';
    state.files.forEach((fileItem, index) => {
      const card = createThumbnailCard(fileItem, index);
      thumbnailsGrid.appendChild(card);
    });

    // Append Add Placeholder card
    const addCard = document.createElement('div');
    addCard.className = 'add-card-placeholder';
    addCard.id = 'addCardPlaceholder';
    addCard.innerHTML = `
      <div class="add-card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span style="font-weight: 700; font-size: 14px;">Add more images</span>
    `;
    addCard.addEventListener('click', () => fileInput.click());
    thumbnailsGrid.appendChild(addCard);

    initSortable();
  }

  function createThumbnailCard(item, index) {
    const card = document.createElement('div');
    card.className = 'thumb-card';
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="thumb-header">
        <span class="thumb-page-num" data-page-indicator>Page ${index + 1}</span>
        <div class="thumb-card-actions">
          <button class="btn-card-action btn-rotate" title="Rotate 90° clockwise" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </button>
          <button class="btn-card-action btn-del" title="Delete image" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="thumb-preview-wrap">
        <img class="thumb-img" src="${item.dataUrl}" alt="${item.name}" style="transform: rotate(${item.rotation}deg);" />
      </div>
      <div class="thumb-footer">
        <div class="thumb-filename" title="${item.name}">${item.name}</div>
        <div class="thumb-meta">
          <span>${item.width}×${item.height}</span>
          <span>${formatBytes(item.size)}</span>
        </div>
      </div>
    `;

    // Rotate Button Handler
    const rotateBtn = card.querySelector('.btn-rotate');
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      item.rotation = (item.rotation + 90) % 360;
      const img = card.querySelector('.thumb-img');
      img.style.transform = `rotate(${item.rotation}deg)`;
    });

    // Delete Button Handler
    const delBtn = card.querySelector('.btn-del');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.files = state.files.filter(f => f.id !== item.id);
      renderWorkspace();
    });

    return card;
  }

  function updatePageNumbers() {
    const cards = thumbnailsGrid.querySelectorAll('.thumb-card');
    cards.forEach((card, idx) => {
      const pageIndicator = card.querySelector('[data-page-indicator]');
      if (pageIndicator) pageIndicator.textContent = `Page ${idx + 1}`;
    });
  }

  // Orientation Selector
  orientationItems.forEach(item => {
    item.addEventListener('click', () => {
      orientationItems.forEach(btn => btn.classList.remove('active'));
      item.classList.add('active');
      state.options.orientation = item.dataset.value;
    });
  });

  // Margin Selector
  marginItems.forEach(item => {
    item.addEventListener('click', () => {
      marginItems.forEach(btn => btn.classList.remove('active'));
      item.classList.add('active');
      state.options.margin = parseInt(item.dataset.value, 10);
    });
  });

  // Page Size Selector
  selectPageSize.addEventListener('change', (e) => {
    state.options.pageSize = e.target.value;
  });

  // Merge Checkbox
  chkMergeAfter.addEventListener('change', (e) => {
    state.options.mergeAfter = e.target.checked;
  });

  // Sort files by name A-Z / Z-A
  btnOrderByName.addEventListener('click', () => {
    sortAscending = !sortAscending;
    state.files.sort((a, b) => {
      const res = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      return sortAscending ? res : -res;
    });
    renderWorkspace();
    showToast(`Sorted files by name (${sortAscending ? 'A to Z' : 'Z to A'})`);
  });

  // Clear All Files
  btnClearAll.addEventListener('click', () => {
    if (confirm('Are you sure you want to remove all images?')) {
      state.files = [];
      renderWorkspace();
    }
  });

  // Input picker triggers
  btnSelectFiles.addEventListener('click', () => fileInput.click());
  btnAddMore.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      fileInput.value = '';
    }
  });

  // Drag and drop events on entire window
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragOverlay.classList.add('active');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragOverlay.classList.remove('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.remove('active');

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Convert Images to PDF via jsPDF
  btnConvert.addEventListener('click', async () => {
    if (state.files.length === 0) {
      showToast('Please add at least one image.');
      return;
    }

    try {
      processingOverlay.classList.add('active');
      progressBarFill.style.width = '10%';
      progressSubtitle.textContent = 'Preparing images...';

      // Load jsPDF from window
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
        throw new Error('jsPDF library failed to load.');
      }

      const totalFiles = state.files.length;
      let pdfDoc = null;

      // Page dimension constants in mm
      const PAGE_SIZES = {
        A4: { width: 210, height: 297 },
        letter: { width: 215.9, height: 279.4 }
      };

      for (let i = 0; i < totalFiles; i++) {
        const item = state.files[i];
        const progressPct = Math.round(((i + 1) / totalFiles) * 85);
        progressBarFill.style.width = `${progressPct}%`;
        progressSubtitle.textContent = `Processing image ${i + 1} of ${totalFiles}...`;

        // Wait small tick to render progress bar smoothly
        await new Promise(r => setTimeout(r, 40));

        // Create rotated canvas if rotation is applied
        const { canvas, format } = await createTransformedImageCanvas(item);

        // Determine Page Orientation and Dimensions
        let orientation = state.options.orientation; // 'portrait' | 'landscape'
        let pageWidthMm, pageHeightMm;

        if (state.options.pageSize === 'fit') {
          // Fit: page matches image aspect ratio exactly
          // Use pixel to mm conversion (approx 0.264583 mm per px at 96 DPI)
          const pxToMm = 0.264583;
          pageWidthMm = canvas.width * pxToMm;
          pageHeightMm = canvas.height * pxToMm;
          orientation = pageWidthMm > pageHeightMm ? 'landscape' : 'portrait';
        } else {
          const standardDim = PAGE_SIZES[state.options.pageSize] || PAGE_SIZES.A4;
          if (orientation === 'landscape') {
            pageWidthMm = Math.max(standardDim.width, standardDim.height);
            pageHeightMm = Math.min(standardDim.width, standardDim.height);
          } else {
            pageWidthMm = Math.min(standardDim.width, standardDim.height);
            pageHeightMm = Math.max(standardDim.width, standardDim.height);
          }
        }

        // Initialize PDF Document on first page, or add new page
        if (i === 0) {
          pdfDoc = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: state.options.pageSize === 'fit' ? [pageWidthMm, pageHeightMm] : state.options.pageSize.toLowerCase()
          });
        } else {
          pdfDoc.addPage(
            state.options.pageSize === 'fit' ? [pageWidthMm, pageHeightMm] : state.options.pageSize.toLowerCase(),
            orientation
          );
        }

        // Apply margins
        const marginMm = state.options.pageSize === 'fit' ? 0 : state.options.margin;
        const availWidth = pageWidthMm - (marginMm * 2);
        const availHeight = pageHeightMm - (marginMm * 2);

        // Calculate aspect ratio fit inside available page area
        const imgAspect = canvas.width / canvas.height;
        let renderWidth = availWidth;
        let renderHeight = availWidth / imgAspect;

        if (renderHeight > availHeight) {
          renderHeight = availHeight;
          renderWidth = availHeight * imgAspect;
        }

        // Center inside page
        const posX = marginMm + (availWidth - renderWidth) / 2;
        const posY = marginMm + (availHeight - renderHeight) / 2;

        const imgData = canvas.toDataURL(format === 'image/png' ? 'image/png' : 'image/jpeg', 0.95);
        pdfDoc.addImage(imgData, format === 'image/png' ? 'PNG' : 'JPEG', posX, posY, renderWidth, renderHeight);
      }

      progressBarFill.style.width = '100%';
      progressSubtitle.textContent = 'Generating PDF file...';
      await new Promise(r => setTimeout(r, 200));

      // Output Blob
      const pdfBlob = pdfDoc.output('blob');
      if (state.convertedPdfUrl) {
        URL.revokeObjectURL(state.convertedPdfUrl);
      }
      state.convertedPdfBlob = pdfBlob;
      state.convertedPdfUrl = URL.createObjectURL(pdfBlob);

      const baseName = state.files[0].name.replace(/\.[^/.]+$/, "");
      state.outputFilename = state.files.length === 1 ? `${baseName}.pdf` : `ilovepdf_${baseName}_and_more.pdf`;

      // Show Success / Download View
      showDownloadView();
    } catch (err) {
      console.error('Error during conversion:', err);
      alert('Error converting files: ' + err.message);
    } finally {
      processingOverlay.classList.remove('active');
    }
  });

  // Helper to draw image onto canvas with applied rotation
  function createTransformedImageCanvas(item) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const rotationRad = (item.rotation * Math.PI) / 180;
        const isOrthogonal = item.rotation % 180 !== 0;

        const canvas = document.createElement('canvas');
        canvas.width = isOrthogonal ? img.naturalHeight : img.naturalWidth;
        canvas.height = isOrthogonal ? img.naturalWidth : img.naturalHeight;

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotationRad);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();

        resolve({ canvas, format: item.file.type });
      };
      img.src = item.dataUrl;
    });
  }

  // Show Download Screen
  function showDownloadView() {
    workspaceView.classList.remove('active');
    landingView.style.display = 'none';
    downloadView.classList.add('active');

    downloadFileName.textContent = state.outputFilename;
    downloadFileMeta.textContent = `${state.files.length} page${state.files.length > 1 ? 's' : ''} • ${formatBytes(state.convertedPdfBlob.size)}`;

    btnDownloadPdf.onclick = () => {
      triggerDownload();
    };

    // Auto trigger download for great user experience (iLovePDF style)
    triggerDownload();
  }

  function triggerDownload() {
    if (!state.convertedPdfUrl) return;
    const a = document.createElement('a');
    a.href = state.convertedPdfUrl;
    a.download = state.outputFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Download started!');
  }

  // Start Over Button
  btnStartOver.addEventListener('click', () => {
    state.files = [];
    state.convertedPdfBlob = null;
    if (state.convertedPdfUrl) {
      URL.revokeObjectURL(state.convertedPdfUrl);
      state.convertedPdfUrl = null;
    }
    renderWorkspace();
  });
});
