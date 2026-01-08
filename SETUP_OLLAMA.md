# Setting Up Ollama for Image Processing

To enable image upload and auto-fill functionality, you need to install Ollama and a vision model.

## Step 1: Install Ollama

1. **Download Ollama** from: https://ollama.ai
2. **Install** the Windows installer
3. **Verify installation** by opening a new terminal and running:
   ```bash
   ollama --version
   ```

## Step 2: Install Vision Model

After Ollama is installed, you need to pull a vision-capable model:

```bash
ollama pull llava
```

This will download the LLaVA model (approximately 4GB). The download may take a few minutes depending on your internet connection.

## Step 3: Verify Installation

Check that the model is installed:

```bash
ollama list
```

You should see `llava` in the list.

## Step 4: Test the Model

You can test the vision model by running:

```bash
ollama run llava
```

## Alternative Vision Models

If you prefer a different vision model, you can use:
- `bakllava` - Alternative vision model
- `llava:latest` - Latest version of LLaVA

Install with:
```bash
ollama pull bakllava
```

## Troubleshooting

### Ollama command not found
- Make sure Ollama is installed
- Restart your terminal after installation
- On Windows, you may need to add Ollama to your PATH

### Model not found
- Make sure Ollama service is running
- Try: `ollama serve` to start the service manually
- Check your internet connection for downloading models

### Connection errors
- Ensure Ollama is running: `ollama list` should work
- Check that `OLLAMA_BASE_URL` in `.env` matches your Ollama server (default: `http://localhost:11434`)

## After Installation

Once Ollama and the vision model are installed:
1. Restart your FastAPI backend server
2. Try uploading an image or pasting a screenshot
3. The form should auto-fill with extracted information







