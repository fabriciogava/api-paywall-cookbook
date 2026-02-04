# Photo Restoration API - Test Suite

Comprehensive test suite for the Photo Restoration API covering unit tests and integration tests.

## Running Tests

### Run All Tests

```bash
# From project root (examples/python/photo-restoration-api)
pytest
```

### Run Specific Test Categories

```bash
# Unit tests only
pytest tests/unit/

# Integration tests only
pytest tests/integration/

# Specific test file
pytest tests/unit/test_opencv_processor.py

# Specific test function
pytest tests/unit/test_opencv_processor.py::test_process_image_valid_jpeg
```

### Run with Coverage

```bash
# Generate coverage report
pytest --cov=src --cov-report=html --cov-report=term-missing

# View HTML report
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

### Run with Markers

```bash
# Run only tests marked as "unit"
pytest -m unit

# Run only tests marked as "integration"
pytest -m integration

# Run only OpenCV-related tests
pytest -m opencv

# Run only payment flow tests
pytest -m payment
```

### Verbose Output

```bash
# Show more details
pytest -v

# Show even more details (including print statements)
pytest -vv -s
```

## Test Structure

```
tests/
├── conftest.py                    # Shared fixtures and test configuration
├── unit/                          # Unit tests (isolated components)
│   ├── test_opencv_processor.py   # OpenCV processing tests
│   ├── test_gemini_restorer.py    # Gemini AI tests (mocked)
│   └── test_config.py             # Configuration validation tests
├── integration/                   # Integration tests (end-to-end)
│   ├── test_api.py                # FastAPI endpoint tests
│   └── test_payment_flow.py       # x402 payment flow tests
└── README.md                      # This file
```

## Test Coverage

### Unit Tests

**OpenCV Processor (`test_opencv_processor.py`)**
- ✅ Valid image processing
- ✅ Invalid image handling
- ✅ Empty image handling
- ✅ Perspective correction
- ✅ Auto-rotation
- ✅ Image enhancement
- ✅ Denoising
- ✅ Large image support
- ✅ Grayscale image support
- ✅ PNG format support

**Gemini Restorer (`test_gemini_restorer.py`)**
- ✅ Initialization with API key
- ✅ API key validation
- ✅ Successful restoration analysis
- ✅ Invalid image handling
- ✅ Restoration instructions
- ✅ API failure handling
- ✅ Empty response handling
- ✅ Model configuration

**Configuration (`test_config.py`)**
- ✅ Valid configuration
- ✅ Optional Kobaru API key
- ✅ Required wallet address
- ✅ Required Gemini API key
- ✅ Default facilitator URL
- ✅ Custom facilitator URL
- ✅ Wallet address format

### Integration Tests

**API Endpoints (`test_api.py`)**
- ✅ Root endpoint (`/`)
- ✅ Health endpoint (`/health`)
- ✅ OpenAPI docs (`/docs`)
- ✅ 402 response without payment
- ✅ Success with valid payment
- ✅ 403 with invalid payment
- ✅ Empty file handling
- ✅ Invalid image format handling
- ✅ CORS headers
- ✅ Payment requirements format

**Payment Flow (`test_payment_flow.py`)**
- ✅ Complete payment flow (402 → payment → 200)
- ✅ Payment verification calls facilitator
- ✅ Malformed payment signature handling
- ✅ Payment header case-insensitivity
- ✅ Multiple independent payment attempts

## Fixtures

### Image Fixtures
- `sample_image_bytes` - Valid 100x100 RGB JPEG
- `sample_skewed_image_bytes` - Image with tilted content for perspective correction tests

### Configuration Fixtures
- `test_config` - Valid AppConfig for testing
- `mock_facilitator_response` - Mocked facilitator /supported response
- `mock_payment_payload` - Mocked EIP-712 payment signature

### Service Fixtures
- `opencv_processor` - OpenCVProcessor instance
- `mock_gemini_restorer` - Mocked GeminiRestorer (no API calls)
- `mock_facilitator_client` - Mocked HTTPFacilitatorClient
- `mock_resource_server` - Mocked x402ResourceServer

### App Fixture
- `test_app` - Complete FastAPI app with all dependencies mocked

## Mocking Strategy

### External Services

All external services are mocked to ensure:
1. **Fast tests** - No network calls
2. **Reliable tests** - No external dependencies
3. **Cost-free tests** - No API charges
4. **Offline testing** - Works without internet

**Mocked Services:**
- Google Gemini API (`genai.GenerativeModel`)
- x402 Facilitator (`HTTPFacilitatorClient`)
- x402 Resource Server (`x402ResourceServer`)
- Blockchain interactions (all handled by facilitator mock)

### Real Implementations Tested

- OpenCV image processing (actual CV algorithms)
- FastAPI routing and middleware
- Pydantic validation
- File upload handling
- Base64 encoding/decoding
- JSON serialization

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.12'

    - name: Install dependencies
      run: |
        pip install -r requirements.txt

    - name: Run tests
      run: |
        pytest --cov=src --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Best Practices

### Writing New Tests

1. **Use descriptive names**: `test_process_image_valid_jpeg` not `test_1`
2. **One assertion per test**: Focus on single behavior
3. **Arrange-Act-Assert pattern**:
   ```python
   def test_something():
       # Arrange - Setup test data
       data = create_test_data()

       # Act - Execute the code under test
       result = function_under_test(data)

       # Assert - Verify the result
       assert result == expected_value
   ```
4. **Use fixtures**: Reuse test data and setup
5. **Mock external dependencies**: Keep tests fast and reliable
6. **Test edge cases**: Empty inputs, invalid data, errors

### Debugging Failing Tests

```bash
# Show print statements
pytest -s

# Stop at first failure
pytest -x

# Show local variables in tracebacks
pytest --showlocals

# Run specific failing test with verbose output
pytest -vv tests/unit/test_opencv_processor.py::test_process_image_valid_jpeg
```

## Adding New Tests

1. Create test file in appropriate directory (`unit/` or `integration/`)
2. Import necessary fixtures from `conftest.py`
3. Write test functions with `test_` prefix
4. Use `@pytest.mark.asyncio` for async tests
5. Add markers if needed: `@pytest.mark.unit`, `@pytest.mark.opencv`, etc.

Example:

```python
import pytest

@pytest.mark.unit
@pytest.mark.opencv
def test_new_opencv_feature(opencv_processor, sample_image_bytes):
    """Test description here"""
    result = opencv_processor.new_feature(sample_image_bytes)
    assert result is not None
```

## Troubleshooting

### "No module named 'app'"

Make sure you're running pytest from the project root:
```bash
cd examples/python/photo-restoration-api
pytest
```

### "Event loop is closed"

Use `@pytest.mark.asyncio` for async tests and ensure `pytest-asyncio` is installed.

### Tests hang or timeout

Check for:
- Actual API calls (should be mocked)
- Infinite loops in code
- Missing `await` on async functions

### Import errors

Ensure your virtual environment is activated:
```bash
source venv/bin/activate  # or .venv/bin/activate
```

## CI/CD Integration

Tests should run automatically on:
- Pull requests
- Pushes to main branch
- Pre-deployment checks

Recommended test gates:
- ✅ All tests must pass
- ✅ Code coverage > 80%
- ✅ No test warnings
- ✅ Tests complete in < 2 minutes
