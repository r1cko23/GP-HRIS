-- =============================================
-- Author:		<Pat Relos>
-- Create date: <2-23-2025>
-- Description:	<Saving picture>
-- =============================================
create PROCEDURE [dbo].[pictureprocessedit]
    @employeeid INT,
    @imagepic VARBINARY(MAX) 
AS	
BEGIN
    SET NOCOUNT ON;

    Update tblpicture 
	SET pictureimage = @imagepic
	where employee_id = @employeeid
	    
END


