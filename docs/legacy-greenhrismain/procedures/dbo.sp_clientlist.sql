CREATE PROCEDURE [dbo].[sp_clientlist] 
	-- Add the parameters for the stored procedure here
	--	@idorganization integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT 	 companyname
FROM     client
WHERE client.tagdelete = N'N' AND clientstatus = 'Active'
order by companyname asc


END
