/*
tuya_crypto.wasm — crypto primitives for the e-Scooter PWA.

Powered by fast_io (AES-128 software backend + MD5).
Buffer ABI: JS writes into wasm memory at get_*_ptr(), calls the op,
reads results back from the out/digest buffers.

Build (direct):
  clang++ -o tuya_crypto.wasm tuya_crypto.cpp -O3 \
      --config=$HOME/herbcfgs/wasm32-wasip1-noeh-nomtg.cfg \
      -flto=thin -fherbceptions -lherbceptions -s \
      -Wl,--no-entry -Wl,--export=__wasm_call_ctors \
      -Wl,--export=get_in_ptr -Wl,--export=get_out_ptr \
      -Wl,--export=get_key_ptr -Wl,--export=get_md5_ptr \
      -Wl,--export=aes128_set_key -Wl,--export=aes128_encrypt \
      -Wl,--export=aes128_decrypt -Wl,--export=md5_digest

or via CMakeLists.txt (mirrors WasmPass).
*/

#include <cstddef>
#include <memory>
#define FAST_IO_NO_WARNING_DEPRECATED_CRYPTO_ALGOS
#include <fast_io_crypto.h>

namespace
{

inline constexpr ::std::size_t buffer_size{1024};

inline ::std::byte inbuf[buffer_size];
inline ::std::byte outbuf[buffer_size];
inline ::std::byte keybuf[16];
inline ::std::byte md5buf[16];

using aes128_ctx = ::fast_io::aes_ctx<16>;
alignas(aes128_ctx) inline ::std::byte gctx_storage[sizeof(aes128_ctx)];
inline aes128_ctx *gctx{};

} // namespace

extern "C" ::std::byte *get_in_ptr() noexcept { return inbuf; }
extern "C" ::std::byte *get_out_ptr() noexcept { return outbuf; }
extern "C" ::std::byte *get_key_ptr() noexcept { return keybuf; }
extern "C" ::std::byte *get_md5_ptr() noexcept { return md5buf; }
extern "C" ::std::size_t get_buffer_size() noexcept { return buffer_size; }

/* call after JS writes 16 bytes at get_key_ptr(); rekey-able */
extern "C" void aes128_set_key() noexcept
{
	if (gctx)
	{
		::std::destroy_at(gctx);
	}
	gctx = ::std::construct_at(reinterpret_cast<aes128_ctx *>(gctx_storage), keybuf);
}

/* nblocks 16-byte blocks, inbuf -> outbuf (ECB) */
extern "C" void aes128_encrypt(::std::size_t nblocks) noexcept
{
	if (gctx == nullptr || nblocks * 16 > buffer_size)
	{
		return;
	}
	gctx->encrypt(inbuf, nblocks, outbuf);
}

extern "C" void aes128_decrypt(::std::size_t nblocks) noexcept
{
	if (gctx == nullptr || nblocks * 16 > buffer_size)
	{
		return;
	}
	gctx->decrypt(inbuf, nblocks, outbuf);
}

/* md5 of nbytes at inbuf -> 16 bytes at md5buf */
extern "C" void md5_digest(::std::size_t nbytes) noexcept
{
	if (nbytes > buffer_size)
	{
		return;
	}
	::fast_io::md5_context ctx;
	ctx.update(inbuf, inbuf + nbytes);
	ctx.do_final();
	ctx.digest_to_byte_ptr(md5buf);
}
