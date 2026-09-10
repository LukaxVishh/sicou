using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Posts;

namespace Sicou.Api.Controllers;

[ApiController]
[Route("api/posts")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IPostService _postService;

    public PostsController(IPostService postService)
    {
        _postService = postService;
    }

    [HttpGet]
    public async Task<IActionResult> GetPage([FromQuery] Guid? companyId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        return Ok(await _postService.GetPageAsync(companyId, page, pageSize));
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Create([FromForm] CreatePostRequest request, IFormFile? image)
    {
        try
        {
            var response = await _postService.CreateAsync(request, ToImageUpload(image));
            return CreatedAtAction(nameof(GetPage), null, response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(Guid id, [FromForm] UpdatePostRequest request, IFormFile? image)
    {
        try
        {
            return Ok(await _postService.UpdateAsync(id, request, ToImageUpload(image)));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _postService.DeleteAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/pin")]
    public async Task<IActionResult> SetPinned(Guid id, [FromBody] SetPostPinnedRequest request)
    {
        try
        {
            return Ok(await _postService.SetPinnedAsync(id, request.IsPinned));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    private static PostImageUpload? ToImageUpload(IFormFile? image)
    {
        if (image is null)
            return null;
        return new PostImageUpload { Content = image.OpenReadStream(), FileName = image.FileName, ContentType = image.ContentType, Length = image.Length };
    }
}
