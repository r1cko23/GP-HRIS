CREATE PROCEDURE [dbo].[sp_payrollmonth] 
	-- Add the parameters for the stored procedure here
	--	@idorganization integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT        payrollmonth, payrollmonthsort
FROM            GREENHRISMAIN.dbo.payroll_summary
GROUP BY payrollmonth, payrollmonthsort
HAVING        (payrollmonthsort >= 202501)
ORDER BY payrollmonthsort desc


END
