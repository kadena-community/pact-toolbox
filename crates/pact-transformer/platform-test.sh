#!/bin/bash

# Comprehensive platform build and test script for pact-transformer
# Usage: ./platform-test.sh [command] [options]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Platform configurations
declare -A PLATFORMS=(
    ["x64-gnu"]="x86_64-unknown-linux-gnu"
    ["x64-musl"]="x86_64-unknown-linux-musl"
    ["arm64-gnu"]="aarch64-unknown-linux-gnu"
    ["arm64-musl"]="aarch64-unknown-linux-musl"
)

declare -A DOCKER_IMAGES=(
    ["x64-gnu"]="ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-debian"
    ["x64-musl"]="node:22-alpine"
    ["arm64-gnu"]="node:22-slim"
    ["arm64-musl"]="node:lts-alpine"
)

declare -A PLATFORM_FLAGS=(
    ["x64-gnu"]=""
    ["x64-musl"]=""
    ["arm64-gnu"]="--platform linux/arm64"
    ["arm64-musl"]="--platform linux/arm64"
)

# Helper functions
print_help() {
    cat << EOF
${BLUE}pact-transformer Platform Test Tool${NC}

${YELLOW}Usage:${NC}
  $0 [command] [options]

${YELLOW}Commands:${NC}
  ${CYAN}build${NC} [platform]      Build native module for platform(s)
  ${CYAN}test${NC} [platform]       Run tests for platform(s)
  ${CYAN}all${NC}                   Build and test all platforms
  ${CYAN}clean${NC}                 Remove all build artifacts
  ${CYAN}list${NC}                  List all available platforms
  ${CYAN}help${NC}                  Show this help message

${YELLOW}Platforms:${NC}
  ${CYAN}x64-gnu${NC}               x86_64-unknown-linux-gnu (glibc)
  ${CYAN}x64-musl${NC}              x86_64-unknown-linux-musl (Alpine)
  ${CYAN}arm64-gnu${NC}             aarch64-unknown-linux-gnu (ARM64 glibc)
  ${CYAN}arm64-musl${NC}            aarch64-unknown-linux-musl (ARM64 Alpine)

${YELLOW}Options:${NC}
  ${CYAN}--parallel${NC}            Run operations in parallel
  ${CYAN}--clean${NC}               Clean before building
  ${CYAN}--verbose${NC}             Show detailed output
  ${CYAN}--no-cache${NC}            Don't use Docker cache

${YELLOW}Examples:${NC}
  $0 build x64-gnu                    # Build for x64 GNU/Linux
  $0 test --parallel                  # Test all platforms in parallel
  $0 all --clean                      # Clean, build, and test everything
  $0 build x64-gnu x64-musl          # Build multiple specific platforms
  $0 test arm64-musl --verbose       # Test ARM64 musl with verbose output

EOF
}

print_status() {
    local type=$1
    local message=$2
    case $type in
        "info") echo -e "${YELLOW}→${NC} $message" ;;
        "success") echo -e "${GREEN}✓${NC} $message" ;;
        "error") echo -e "${RED}✗${NC} $message" ;;
        "header") echo -e "\n${BLUE}=== $message ===${NC}" ;;
    esac
}

setup_qemu() {
    if [[ "$1" == "arm64-gnu" ]] || [[ "$1" == "arm64-musl" ]]; then
        print_status "info" "Setting up QEMU for ARM emulation..."
        print_status "info" "Warning: ARM64 builds under emulation are very slow (10-30 minutes)"
        docker run --rm --privileged multiarch/qemu-user-static --reset -p yes >/dev/null 2>&1
    fi
}

clean_artifacts() {
    print_status "header" "Cleaning Build Artifacts"
    
    # Check if we have files to clean
    local has_artifacts=false
    [ -d "$ROOT_DIR/target" ] && has_artifacts=true
    ls "$SCRIPT_DIR"/*.node >/dev/null 2>&1 && has_artifacts=true
    [ -d "$SCRIPT_DIR/node_modules" ] && has_artifacts=true
    
    if [ "$has_artifacts" = false ]; then
        print_status "info" "No artifacts to clean"
        return 0
    fi
    
    # Use Docker to clean files (avoids permission issues)
    print_status "info" "Cleaning artifacts using Docker..."
    
    docker run --rm -v "$ROOT_DIR:/build" -w /build alpine:latest sh -c "
        echo 'Cleaning build artifacts...'
        # Remove target directory
        if [ -d target ]; then
            echo '  Removing target directory...'
            rm -rf target
        fi
        
        # Remove .node files
        if ls crates/pact-transformer/*.node >/dev/null 2>&1; then
            echo '  Removing .node files...'
            rm -f crates/pact-transformer/*.node
        fi
        
        # Remove node_modules
        if [ -d crates/pact-transformer/node_modules ]; then
            echo '  Removing node_modules...'
            rm -rf crates/pact-transformer/node_modules
        fi
        
        echo 'Clean complete'
    " || {
        print_status "error" "Docker clean failed, trying with sudo..."
        # Fallback to sudo if Docker fails
        sudo rm -rf "$ROOT_DIR/target" 2>/dev/null
        sudo rm -f "$SCRIPT_DIR"/*.node 2>/dev/null
        rm -rf "$SCRIPT_DIR/node_modules" 2>/dev/null
    }
    
    print_status "success" "Clean complete"
}

get_build_command() {
    local platform=$1
    case $platform in
        "x64-gnu")
            echo "set -e &&
                corepack disable || true &&
                apt-get update -qq && apt-get install -y -qq libc6-dev build-essential curl xz-utils >/dev/null 2>&1 &&
                curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz | tar -xJ -C /usr/local --strip-components=1 &&
                rustup target add x86_64-unknown-linux-gnu &&
                npm install -g pnpm@10.12.4 >/dev/null 2>&1 &&
                # Install dependencies at root level first
                pnpm install --frozen-lockfile &&
                cd crates/pact-transformer &&
                # Install local dependencies for this package
                pnpm install --frozen-lockfile &&
                export CC_x86_64_unknown_linux_gnu=gcc &&
                export AR_x86_64_unknown_linux_gnu=ar &&
                export CFLAGS_x86_64_unknown_linux_gnu='-D_GNU_SOURCE -D_DEFAULT_SOURCE' &&
                export CPPFLAGS_x86_64_unknown_linux_gnu='-D_GNU_SOURCE -D_DEFAULT_SOURCE' &&
                export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=gcc &&
                export RUSTFLAGS='-C link-arg=-Wl,--no-as-needed' &&
                npx @napi-rs/cli build --platform --release --target x86_64-unknown-linux-gnu &&
                strip *.node"
            ;;
        "x64-musl")
            echo "set -e &&
                apk add --no-cache npm file python3 make g++ gcc musl-dev linux-headers git curl xz >/dev/null 2>&1 &&
                # Install rustup manually since Alpine's rust package doesn't include rustup
                curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal &&
                source /root/.cargo/env &&
                rustup target add x86_64-unknown-linux-musl &&
                # Install Zig for cross-compilation
                mkdir -p /usr/local/bin &&
                curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz | tar -xJ -C /tmp &&
                mv /tmp/zig-linux-x86_64-0.13.0/zig /usr/local/bin/ &&
                chmod +x /usr/local/bin/zig &&
                export PATH=/usr/local/bin:\$PATH &&
                corepack disable || true &&
                npm install -g pnpm@10.12.4 >/dev/null 2>&1 &&
                # Install dependencies at root level first
                pnpm install --frozen-lockfile &&
                cd crates/pact-transformer &&
                # Install local dependencies for this package
                pnpm install --frozen-lockfile &&
                # Set Zig as the linker
                export CC='zig cc -target x86_64-linux-musl' &&
                export CXX='zig c++ -target x86_64-linux-musl' &&
                npx @napi-rs/cli build --platform --release --target x86_64-unknown-linux-musl &&
                strip *.node"
            ;;
        "arm64-gnu")
            echo "set -e &&
                export DEBIAN_FRONTEND=noninteractive &&
                apt-get update -qq && apt-get install -y -qq ca-certificates gnupg curl build-essential gcc-aarch64-linux-gnu xz-utils binutils-aarch64-linux-gnu >/dev/null 2>&1 &&
                # Install rustup manually
                curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal &&
                source /root/.cargo/env &&
                rustup target add aarch64-unknown-linux-gnu &&
                corepack disable || true &&
                npm install -g pnpm@10.12.4 >/dev/null 2>&1 &&
                # Install dependencies at root level first
                pnpm install --frozen-lockfile &&
                cd crates/pact-transformer &&
                # Install local dependencies for this package
                pnpm install --frozen-lockfile &&
                pnpm config set supportedArchitectures.cpu 'arm64' &&
                pnpm config set supportedArchitectures.libc 'glibc' &&
                export CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc &&
                export AR_aarch64_unknown_linux_gnu=aarch64-linux-gnu-ar &&
                export CFLAGS_aarch64_unknown_linux_gnu='-D_GNU_SOURCE -D_DEFAULT_SOURCE' &&
                export CPPFLAGS_aarch64_unknown_linux_gnu='-D_GNU_SOURCE -D_DEFAULT_SOURCE' &&
                export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc &&
                export RUSTFLAGS='-C link-arg=-Wl,--no-as-needed' &&
                npx @napi-rs/cli build --platform --release --target aarch64-unknown-linux-gnu &&
                aarch64-linux-gnu-strip *.node"
            ;;
        "arm64-musl")
            echo "set -e &&
                apk add --no-cache npm file python3 make g++ gcc musl-dev linux-headers git curl xz >/dev/null 2>&1 &&
                # Install rustup manually since Alpine's rust package doesn't include rustup
                curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal &&
                source /root/.cargo/env &&
                rustup target add aarch64-unknown-linux-musl &&
                # Install Zig for cross-compilation (try arm64 first, fall back to x64)
                mkdir -p /usr/local/bin &&
                (curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-aarch64-0.13.0.tar.xz | tar -xJ -C /tmp &&
                 mv /tmp/zig-linux-aarch64-0.13.0/zig /usr/local/bin/) ||
                (curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz | tar -xJ -C /tmp &&
                 mv /tmp/zig-linux-x86_64-0.13.0/zig /usr/local/bin/) &&
                chmod +x /usr/local/bin/zig &&
                export PATH=/usr/local/bin:\$PATH &&
                corepack disable || true &&
                npm install -g pnpm@10.12.4 >/dev/null 2>&1 &&
                # Install dependencies at root level first
                pnpm install --frozen-lockfile &&
                cd crates/pact-transformer &&
                # Install local dependencies for this package
                pnpm install --frozen-lockfile &&
                pnpm config set supportedArchitectures.cpu 'arm64' &&
                pnpm config set supportedArchitectures.libc 'musl' &&
                # Set Zig as the linker
                export CC='zig cc -target aarch64-linux-musl' &&
                export CXX='zig c++ -target aarch64-linux-musl' &&
                npx @napi-rs/cli build --platform --release --target aarch64-unknown-linux-musl &&
                strip *.node"
            ;;
    esac
}

get_test_command() {
    local platform=$1
    case $platform in
        "x64-gnu"|"x64-musl")
            echo "cd crates/pact-transformer &&
                ls -la *.node &&
                file *.node &&
                echo 'Testing module loading...' &&
                node test-module.js &&
                pnpm test"
            ;;
        "arm64-gnu")
            echo "cd crates/pact-transformer &&
                export LD_LIBRARY_PATH=/usr/lib/aarch64-linux-gnu:/lib/aarch64-linux-gnu &&
                ls -la *.node &&
                file *.node &&
                echo 'Testing module loading...' &&
                node test-module.js &&
                pnpm test"
            ;;
        "arm64-musl")
            echo "cd crates/pact-transformer &&
                ls -la *.node &&
                file *.node &&
                echo 'Testing module loading...' &&
                node test-module.js &&
                DEBUG=napi:* pnpm test"
            ;;
    esac
}

run_docker_command() {
    local platform=$1
    local command=$2
    local verbose=$3
    local no_cache=$4
    
    local image="${DOCKER_IMAGES[$platform]}"
    local platform_flag="${PLATFORM_FLAGS[$platform]}"
    local cache_flag=""
    
    if [ "$no_cache" = true ]; then
        cache_flag="--pull=always"
    fi
    
    # Get current user/group for fixing permissions later
    local uid=$(id -u)
    local gid=$(id -g)
    
    # Determine shell based on image (Alpine uses sh, others use bash)
    local shell="bash"
    if [[ "$image" == *"alpine"* ]]; then
        shell="sh"
    fi
    
    local docker_cmd="docker run --rm $cache_flag $platform_flag -v \"$ROOT_DIR:/build\" -w /build \"$image\""
    
    # Add command to fix ownership after build (only on Linux)
    local ownership_fix=""
    if [[ "$OSTYPE" != "darwin"* ]]; then
        ownership_fix=" && (chown -R $uid:$gid /build/target /build/crates/pact-transformer/*.node 2>/dev/null || true)"
    fi
    
    local full_command="$command$ownership_fix"
    
    if [ "$verbose" = true ]; then
        eval "$docker_cmd $shell -c \"$full_command\""
    else
        eval "$docker_cmd $shell -c \"$full_command\"" 2>&1 | while IFS= read -r line; do
            if [[ $line == *"error"* ]] || [[ $line == *"Error"* ]] || [[ $line == *"failed"* ]]; then
                echo -e "${RED}$line${NC}"
            elif [[ $line == *"warning"* ]] || [[ $line == *"Warning"* ]]; then
                echo -e "${YELLOW}$line${NC}"
            elif [[ $line == *"success"* ]] || [[ $line == *"✓"* ]]; then
                echo -e "${GREEN}$line${NC}"
            else
                echo "$line"
            fi
        done
    fi
}

build_platform() {
    local platform=$1
    local verbose=$2
    local no_cache=$3
    
    print_status "info" "Building ${PLATFORMS[$platform]}..."
    setup_qemu "$platform"
    
    local build_cmd=$(get_build_command "$platform")
    
    if run_docker_command "$platform" "$build_cmd" "$verbose" "$no_cache"; then
        print_status "success" "${PLATFORMS[$platform]} build complete"
        return 0
    else
        print_status "error" "${PLATFORMS[$platform]} build failed"
        return 1
    fi
}

test_platform() {
    local platform=$1
    local verbose=$2
    local no_cache=$3
    
    print_status "info" "Testing ${PLATFORMS[$platform]}..."
    setup_qemu "$platform"
    
    local test_cmd=$(get_test_command "$platform")
    
    if run_docker_command "$platform" "$test_cmd" "$verbose" "$no_cache"; then
        print_status "success" "${PLATFORMS[$platform]} tests passed"
        return 0
    else
        print_status "error" "${PLATFORMS[$platform]} tests failed"
        return 1
    fi
}

run_parallel() {
    local operation=$1
    shift
    local platforms=("$@")
    local verbose=false
    local no_cache=false
    
    # Extract flags
    local clean_platforms=()
    for arg in "${platforms[@]}"; do
        case $arg in
            --verbose) verbose=true ;;
            --no-cache) no_cache=true ;;
            *) clean_platforms+=("$arg") ;;
        esac
    done
    platforms=("${clean_platforms[@]}")
    
    # If no platforms specified, use all
    if [ ${#platforms[@]} -eq 0 ]; then
        platforms=("${!PLATFORMS[@]}")
    fi
    
    print_status "header" "Running $operation for ${#platforms[@]} platforms in parallel"
    
    # Create temp directory for logs
    local log_dir="/tmp/pact-transformer-$(date +%s)"
    mkdir -p "$log_dir"
    
    # Start operations in background
    local pids=()
    for platform in "${platforms[@]}"; do
        (
            if [ "$operation" = "build" ]; then
                build_platform "$platform" "$verbose" "$no_cache" > "$log_dir/${platform}.log" 2>&1
            else
                test_platform "$platform" "$verbose" "$no_cache" > "$log_dir/${platform}.log" 2>&1
            fi
        ) &
        pids+=($!)
        print_status "info" "Started $operation for ${PLATFORMS[$platform]}"
    done
    
    # Wait for all to complete
    local failed=0
    for i in "${!pids[@]}"; do
        if wait "${pids[$i]}"; then
            print_status "success" "${PLATFORMS[${platforms[$i]}]} $operation complete"
        else
            print_status "error" "${PLATFORMS[${platforms[$i]}]} $operation failed"
            echo "    Log: $log_dir/${platforms[$i]}.log"
            ((failed++))
        fi
    done
    
    if [ $failed -gt 0 ]; then
        print_status "error" "$failed platforms failed"
        return 1
    else
        print_status "success" "All platforms completed successfully"
        return 0
    fi
}

# Main command processing
main() {
    local command=${1:-help}
    shift || true
    
    local platforms=()
    local parallel=false
    local clean_first=false
    local verbose=false
    local no_cache=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --parallel) parallel=true; shift ;;
            --clean) clean_first=true; shift ;;
            --verbose) verbose=true; shift ;;
            --no-cache) no_cache=true; shift ;;
            -*) print_status "error" "Unknown option: $1"; exit 1 ;;
            *) 
                if [[ -n "${PLATFORMS[$1]}" ]]; then
                    platforms+=("$1")
                else
                    print_status "error" "Unknown platform: $1"
                    print_status "info" "Available platforms: ${!PLATFORMS[*]}"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # If no platforms specified, use all
    if [ ${#platforms[@]} -eq 0 ]; then
        platforms=("${!PLATFORMS[@]}")
    fi
    
    # Clean if requested
    if [ "$clean_first" = true ]; then
        clean_artifacts
    fi
    
    # Execute command
    case $command in
        help)
            print_help
            ;;
        list)
            print_status "header" "Available Platforms"
            for key in "${!PLATFORMS[@]}"; do
                echo -e "  ${CYAN}$key${NC} -> ${PLATFORMS[$key]}"
            done
            ;;
        clean)
            clean_artifacts
            ;;
        build)
            if [ "$parallel" = true ]; then
                run_parallel "build" "${platforms[@]}" ${verbose:+--verbose} ${no_cache:+--no-cache}
            else
                for platform in "${platforms[@]}"; do
                    build_platform "$platform" "$verbose" "$no_cache" || exit 1
                done
            fi
            ;;
        test)
            if [ "$parallel" = true ]; then
                run_parallel "test" "${platforms[@]}" ${verbose:+--verbose} ${no_cache:+--no-cache}
            else
                for platform in "${platforms[@]}"; do
                    test_platform "$platform" "$verbose" "$no_cache" || exit 1
                done
            fi
            ;;
        all)
            # Build all first
            if [ "$parallel" = true ]; then
                run_parallel "build" "${platforms[@]}" ${verbose:+--verbose} ${no_cache:+--no-cache} || exit 1
            else
                for platform in "${platforms[@]}"; do
                    build_platform "$platform" "$verbose" "$no_cache" || exit 1
                done
            fi
            
            # Then test all
            print_status "header" "Build Artifacts"
            ls -la "$SCRIPT_DIR"/*.node 2>/dev/null || echo "No .node files found"
            
            if [ "$parallel" = true ]; then
                run_parallel "test" "${platforms[@]}" ${verbose:+--verbose} ${no_cache:+--no-cache}
            else
                for platform in "${platforms[@]}"; do
                    test_platform "$platform" "$verbose" "$no_cache" || exit 1
                done
            fi
            ;;
        *)
            print_status "error" "Unknown command: $command"
            print_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"