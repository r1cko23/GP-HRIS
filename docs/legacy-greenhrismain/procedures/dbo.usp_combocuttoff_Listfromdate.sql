create PROCEDURE [dbo].[usp_combocuttoff_Listfromdate] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;
	
SELECT DISTINCT CONVERT(VARCHAR(10), Date_Start, 120) AS date_start1, CONVERT(varchar(10), Date_Start, 101) AS date_Start2
FROM            payroll_summary
WHERE        (idclientp = @idclient)
ORDER BY date_start1 asc


END