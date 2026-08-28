CREATE PROCEDURE [dbo].[usp_combopayoutdate_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

--payrolldate field shows dd/mm/yyyy format in payroll report so that create another columns called payrolldate1 that convert to a mm/dd/yyy 101 in short  

/*101 format means mm/dd/yyyy cut to 10 digit*/ 
/*120 format means yyyy-mm-dd cut to 10 digit*/

SELECT DISTINCT CONVERT(VARCHAR(10), payrolldate, 120) payrolldate1 , CONVERT(VARCHAR(10), payrolldate, 101) AS payrolldate2
FROM payroll_summary
WHERE idclientp = @idclient
ORDER BY payrolldate1 DESC


END